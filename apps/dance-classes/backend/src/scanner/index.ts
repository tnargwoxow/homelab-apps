import path from 'node:path';
import fs from 'node:fs';
import type { FSWatcher } from 'chokidar';
import type { DB } from '../db/index.js';
import type { Logger } from '../types.js';
import { walkLibrary } from './walker.js';
import { startWatcher } from './watcher.js';
import { WorkQueue } from './queue.js';
import { ffprobe } from '../lib/ffprobe.js';
import { generateThumbnail } from '../lib/thumbnails.js';

interface StartOpts {
  db: DB;
  videosDir: string;
  thumbDir: string;
  probeConcurrency: number;
  thumbConcurrency: number;
  logger: Logger;
}

interface ScanState {
  db: DB;
  videosDir: string;
  thumbDir: string;
  logger: Logger;
  probeQueue: WorkQueue;
  thumbQueue: WorkQueue;
  watcher: FSWatcher | null;
  scanning: boolean;
  workersTimer: NodeJS.Timeout | null;
  // Ids currently queued or running, so pumpWorkers doesn't enqueue duplicates
  // every tick. Separate sets per phase since a video can move pending -> probed.
  inFlightProbe: Set<number>;
  inFlightThumb: Set<number>;
}

let state: ScanState | null = null;

interface PendingVideoRow {
  id: number;
  rel_path: string;
}

interface ProbedVideoRow {
  id: number;
  rel_path: string;
  duration_sec: number | null;
}

function thumbPathFor(thumbDir: string, id: number): string {
  return path.join(thumbDir, `${id}.jpg`);
}

async function probeOne(s: ScanState, row: PendingVideoRow): Promise<void> {
  const abs = path.join(s.videosDir, row.rel_path);
  try {
    const { durationSec } = await ffprobe(abs);
    s.db.prepare(
      "UPDATE videos SET duration_sec = ?, scan_status = 'probed', scan_error = NULL, updated_at = unixepoch() WHERE id = ?"
    ).run(durationSec, row.id);
  } catch (err) {
    s.logger.warn({ err, file: row.rel_path }, 'ffprobe failed');
    s.db.prepare(
      "UPDATE videos SET scan_status = 'error', scan_error = ?, updated_at = unixepoch() WHERE id = ?"
    ).run(String((err as Error).message ?? err), row.id);
  }
}

async function thumbOne(s: ScanState, row: ProbedVideoRow): Promise<void> {
  const abs = path.join(s.videosDir, row.rel_path);
  const out = thumbPathFor(s.thumbDir, row.id);
  try {
    await generateThumbnail({ videoPath: abs, outPath: out, durationSec: row.duration_sec });
    s.db.prepare(
      "UPDATE videos SET thumb_path = ?, scan_status = 'ready', scan_error = NULL, updated_at = unixepoch() WHERE id = ?"
    ).run(out, row.id);
  } catch (err) {
    s.logger.warn({ err, file: row.rel_path }, 'thumbnail generation failed');
    s.db.prepare(
      "UPDATE videos SET scan_status = 'error', scan_error = ?, updated_at = unixepoch() WHERE id = ?"
    ).run(String((err as Error).message ?? err), row.id);
  }
}

function pumpWorkers(s: ScanState): void {
  // Cap how many we enqueue so the queue doesn't grow unboundedly when the
  // library is large. The work queue itself only runs `concurrency` at a time,
  // but the waiting list can otherwise pile up tens of thousands of closures.
  const probeBudget = s.probeQueue.concurrency * 2 + 4;
  const thumbBudget = s.thumbQueue.concurrency * 2 + 4;

  // Probe pending videos (status='pending'), skipping anything already in flight
  if (s.inFlightProbe.size < probeBudget) {
    const pendingProbe = s.db
      .prepare<[], PendingVideoRow>("SELECT id, rel_path FROM videos WHERE scan_status='pending' LIMIT 200")
      .all();
    for (const row of pendingProbe) {
      if (s.inFlightProbe.has(row.id)) continue;
      if (s.inFlightProbe.size >= probeBudget) break;
      s.inFlightProbe.add(row.id);
      void s.probeQueue.run(async () => {
        try {
          await probeOne(s, row);
        } finally {
          s.inFlightProbe.delete(row.id);
          // Pump again right away so the next item starts without waiting for
          // the next tick of the 1.5s timer.
          if (state) pumpWorkers(state);
        }
      });
    }
  }

  // Thumbnail probed videos (status='probed' AND thumb_path IS NULL)
  if (s.inFlightThumb.size < thumbBudget) {
    const pendingThumb = s.db
      .prepare<[], ProbedVideoRow>(
        "SELECT id, rel_path, duration_sec FROM videos WHERE scan_status='probed' AND thumb_path IS NULL LIMIT 200"
      )
      .all();
    for (const row of pendingThumb) {
      if (s.inFlightThumb.has(row.id)) continue;
      if (s.inFlightThumb.size >= thumbBudget) break;
      s.inFlightThumb.add(row.id);
      void s.thumbQueue.run(async () => {
        try {
          await thumbOne(s, row);
        } finally {
          s.inFlightThumb.delete(row.id);
          if (state) pumpWorkers(state);
        }
      });
    }
  }
}

export function startScanner(opts: StartOpts): void {
  state = {
    db: opts.db,
    videosDir: opts.videosDir,
    thumbDir: opts.thumbDir,
    logger: opts.logger,
    probeQueue: new WorkQueue(opts.probeConcurrency),
    thumbQueue: new WorkQueue(opts.thumbConcurrency),
    watcher: null,
    scanning: false,
    workersTimer: null,
    inFlightProbe: new Set<number>(),
    inFlightThumb: new Set<number>()
  };

  fs.mkdirSync(opts.thumbDir, { recursive: true });

  const initial = async () => {
    if (!state) return;
    state.scanning = true;
    try {
      const summary = await walkLibrary(state.db, state.videosDir);
      state.logger.info({ summary }, 'initial walk complete');
      // Kick the workers immediately after the walk so we don't wait for the
      // periodic timer to begin processing.
      if (state) pumpWorkers(state);
    } catch (err) {
      state.logger.error({ err }, 'initial walk failed');
    } finally {
      if (state) state.scanning = false;
    }
  };
  void initial();

  // Periodic safety-net pump in case rows appear via the watcher while the
  // queues are idle. The main driver is now the post-job pump in pumpWorkers.
  state.workersTimer = setInterval(() => {
    if (!state) return;
    pumpWorkers(state);
  }, 5000);

  state.watcher = startWatcher({
    db: state.db,
    videosDir: state.videosDir,
    logger: state.logger,
    onChange: () => state && pumpWorkers(state)
  });

  opts.logger.info(
    { probeConcurrency: opts.probeConcurrency, thumbConcurrency: opts.thumbConcurrency },
    'scanner started'
  );
}

export async function stopScanner(): Promise<void> {
  if (!state) return;
  if (state.workersTimer) clearInterval(state.workersTimer);
  if (state.watcher) await state.watcher.close();
  state = null;
}

export function triggerRescan(): void {
  if (!state) return;
  state.scanning = true;
  walkLibrary(state.db, state.videosDir)
    .then(summary => {
      state?.logger.info({ summary }, 'manual rescan complete');
      if (state) pumpWorkers(state);
    })
    .catch(err => state?.logger.error({ err }, 'manual rescan failed'))
    .finally(() => { if (state) state.scanning = false; });
}

export function getStatus(db: DB): {
  scanning: boolean;
  total: number;
  probed: number;
  thumbnailed: number;
  errored: number;
  queueDepth: number;
} {
  const totals = db.prepare<[], {
    total: number;
    probed: number;
    thumbnailed: number;
    errored: number;
  }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN scan_status IN ('probed','ready') THEN 1 ELSE 0 END) AS probed,
      SUM(CASE WHEN thumb_path IS NOT NULL THEN 1 ELSE 0 END) AS thumbnailed,
      SUM(CASE WHEN scan_status='error' AND scan_error_ignored = 0 THEN 1 ELSE 0 END) AS errored
    FROM videos
  `).get() ?? { total: 0, probed: 0, thumbnailed: 0, errored: 0 };

  const queueDepth = state ? state.probeQueue.size() + state.thumbQueue.size() : 0;
  return {
    scanning: state?.scanning ?? false,
    total: Number(totals.total ?? 0),
    probed: Number(totals.probed ?? 0),
    thumbnailed: Number(totals.thumbnailed ?? 0),
    errored: Number(totals.errored ?? 0),
    queueDepth
  };
}
