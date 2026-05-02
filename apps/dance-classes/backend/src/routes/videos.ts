import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import type { DB } from '../db/index.js';
import type { Config } from '../config.js';
import { resolveSafe } from '../lib/pathSafety.js';

interface VideoMetaRow {
  id: number;
  folder_id: number;
  filename: string;
  display_title: string;
  episode_num: number | null;
  rel_path: string;
  duration_sec: number | null;
  size_bytes: number;
  thumb_path: string | null;
  scan_status: string;
  position_seconds: number | null;
  duration_seconds: number | null;
  watched: number | null;
  is_favorite: number;
}

interface SiblingRow {
  id: number;
  display_title: string;
  episode_num: number | null;
  filename: string;
}

const EXT_TO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo'
};

function getMime(filename: string): string {
  return EXT_TO_MIME[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

interface FolderBreadcrumbRow {
  id: number;
  parent_id: number | null;
  display_name: string;
}

function buildBreadcrumb(db: DB, folderId: number): Array<{ id: number; name: string }> {
  const stmt = db.prepare<[number], FolderBreadcrumbRow>(
    'SELECT id, parent_id, display_name FROM folders WHERE id = ?'
  );
  const out: Array<{ id: number; name: string }> = [];
  let id: number | null = folderId;
  while (id !== null) {
    const row = stmt.get(id);
    if (!row) break;
    if (row.parent_id !== null) {
      out.unshift({ id: row.id, name: row.display_name });
    }
    id = row.parent_id;
  }
  return out;
}

function findSiblings(db: DB, folderId: number, currentId: number, episodeNum: number | null, filename: string) {
  const all = db.prepare<[number], SiblingRow & { folder_id: number }>(`
    SELECT id, display_title, episode_num, filename, folder_id
    FROM videos
    WHERE folder_id = ?
    ORDER BY (episode_num IS NULL), episode_num ASC, filename ASC
  `).all(folderId);
  const idx = all.findIndex(r => r.id === currentId);
  void episodeNum;
  void filename;
  return {
    siblings: all.map(r => ({
      id: r.id,
      title: r.display_title,
      episodeNum: r.episode_num,
      filename: r.filename,
      current: r.id === currentId
    })),
    prev: idx > 0 ? all[idx - 1].id : null,
    next: idx >= 0 && idx < all.length - 1 ? all[idx + 1].id : null
  };
}

export async function registerVideoRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB; config: Config }
): Promise<void> {
  const { db, config } = opts;

  const getMeta = db.prepare<[number], VideoMetaRow>(`
    SELECT
      v.id, v.folder_id, v.filename, v.display_title, v.episode_num, v.rel_path,
      v.duration_sec, v.size_bytes, v.thumb_path, v.scan_status,
      p.position_seconds, p.duration_seconds, p.watched,
      CASE WHEN fav.video_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
    FROM videos v
    LEFT JOIN progress p ON p.video_id = v.id
    LEFT JOIN favorites fav ON fav.video_id = v.id
    WHERE v.id = ?
  `);

  app.get<{ Params: { id: string } }>('/api/videos/:id', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
    const row = getMeta.get(id);
    if (!row) return reply.code(404).send({ error: 'Video not found' });
    const breadcrumb = buildBreadcrumb(db, row.folder_id);
    const { siblings, prev, next } = findSiblings(db, row.folder_id, row.id, row.episode_num, row.filename);
    return {
      id: row.id,
      title: row.display_title,
      filename: row.filename,
      episodeNum: row.episode_num,
      durationSec: row.duration_sec,
      sizeBytes: row.size_bytes,
      hasThumb: !!row.thumb_path,
      scanStatus: row.scan_status,
      folderId: row.folder_id,
      breadcrumb,
      progress: {
        position: row.position_seconds ?? 0,
        duration: row.duration_seconds ?? row.duration_sec ?? null,
        watched: !!row.watched
      },
      favorite: !!row.is_favorite,
      siblings,
      prevId: prev,
      nextId: next
    };
  });

  app.get<{ Params: { id: string } }>('/api/videos/:id/thumb', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
    const row = db
      .prepare<[number], { thumb_path: string | null }>('SELECT thumb_path FROM videos WHERE id = ?')
      .get(id);
    if (!row || !row.thumb_path || !fs.existsSync(row.thumb_path)) {
      reply.code(404);
      return reply.send({ error: 'No thumbnail' });
    }
    reply.header('Cache-Control', 'private, max-age=86400');
    reply.type('image/jpeg');
    return fs.createReadStream(row.thumb_path);
  });

  app.get<{ Params: { id: string } }>('/api/videos/:id/stream', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
    const row = db
      .prepare<[number], { rel_path: string; size_bytes: number; filename: string }>(
        'SELECT rel_path, size_bytes, filename FROM videos WHERE id = ?'
      )
      .get(id);
    if (!row) return reply.code(404).send({ error: 'Video not found' });

    let absPath: string;
    try {
      absPath = resolveSafe(config.videosDir, row.rel_path);
    } catch {
      return reply.code(400).send({ error: 'Invalid path' });
    }

    let stat;
    try {
      stat = await fs.promises.stat(absPath);
    } catch {
      return reply.code(404).send({ error: 'File missing' });
    }
    const fileSize = stat.size;
    const mime = getMime(row.filename);

    return streamWithRange(req, reply, absPath, fileSize, mime);
  });
}

function parseRange(headerValue: string, fileSize: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(headerValue.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  let start: number;
  let end: number;
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    // suffix: last N bytes
    const suffix = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr === '' ? fileSize - 1 : Number.parseInt(endStr, 10);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) return null;
  if (end >= fileSize) end = fileSize - 1;
  return { start, end };
}

async function streamWithRange(
  req: FastifyRequest,
  reply: FastifyReply,
  absPath: string,
  fileSize: number,
  mime: string
): Promise<void> {
  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileSize);
    if (!range) {
      reply.code(416).header('Content-Range', `bytes */${fileSize}`).send();
      return;
    }
    const { start, end } = range;
    const length = end - start + 1;
    reply.code(206);
    reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Length', String(length));
    reply.header('Content-Type', mime);
    reply.header('Cache-Control', 'private, no-transform');
    const stream = fs.createReadStream(absPath, { start, end });
    return reply.send(stream);
  }
  reply.code(200);
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Content-Length', String(fileSize));
  reply.header('Content-Type', mime);
  reply.header('Cache-Control', 'private, no-transform');
  return reply.send(fs.createReadStream(absPath));
}
