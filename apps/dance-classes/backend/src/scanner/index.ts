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
  // Probe pending videos (status='pending')
  const pendingProbe = s.db
    .prepare<[], PendingVideoRow>("SELECT id, rel_path FROM videos WHERE scan_status='pending' LIMIT 50")
    .all();
  for (const row of pendingProbe) {
    void s.probeQueue.run(() => probeOne(s, row));
  }
  // Thumbnail probed videos (status='probed' AND thumb_path IS NULL)
  const pendingThumb = s.db
    .prepare<[], ProbedVideoRow>("SELECT id, rel_path, duration_sec FROM videos WHERE scan_status='probed' AND thumb_path IS NULL LIMIT 50")
    .all();
  for (const row of pendingThumb) {
    void s.thumbQueue.run(() => thumbOne(s, row));
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
    workersTimer: null
  };

  fs.mkdirSync(opts.thumbDir, { recursive: true });

  const initial = async () => {
    if (!state) return;
    state.scanning = true;
    try {
      const summary = await walkLibrary(state.db, state.videosDir);
      state.logger.info({ summary }, 'initial walk complete');
    } catch (err) {
      state.logger.error({ err }, 'initial walk failed');
    } finally {
      if (state) state.scanning = false;
    }
  };
  void initial();

  state.workersTimer = setInterval(() => {
    if (!state) return;
    pumpWorkers(state);
  }, 1500);

  state.watcher = startWatcher({
    db: state.db,
    videosDir: state.videosDir,
    logger: state.logger,
    onChange: () => state && pumpWorkers(state)
  });
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
    .then(summary => state?.logger.info({ summary }, 'manual rescan complete'))
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
      SUM(CASE WHEN scan_status='error' THEN 1 ELSE 0 END) AS errored
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
