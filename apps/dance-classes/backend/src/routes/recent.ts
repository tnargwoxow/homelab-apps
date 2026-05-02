import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface RecentRow {
  id: number;
  display_title: string;
  duration_sec: number | null;
  has_thumb: number;
  folder_id: number;
  position_seconds: number;
  duration_seconds: number | null;
  watched: number;
  updated_at: number;
}

function shapeRow(r: RecentRow) {
  return {
    id: r.id,
    title: r.display_title,
    durationSec: r.duration_sec,
    hasThumb: !!r.has_thumb,
    folderId: r.folder_id,
    position: r.position_seconds,
    progressDuration: r.duration_seconds,
    watched: !!r.watched,
    updatedAt: r.updated_at
  };
}

export async function registerRecentRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.get<{ Querystring: { limit?: string } }>('/api/recent', async req => {
    const limit = Math.min(Math.max(Number.parseInt((req.query.limit ?? '20').toString(), 10) || 20, 1), 100);
    const rows = db.prepare<[number], RecentRow>(`
      SELECT v.id, v.display_title, v.duration_sec,
        CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
        v.folder_id,
        p.position_seconds, p.duration_seconds, p.watched, p.updated_at
      FROM progress p JOIN videos v ON v.id = p.video_id
      ORDER BY p.updated_at DESC
      LIMIT ?
    `).all(limit);
    return { items: rows.map(shapeRow) };
  });

  app.get<{ Querystring: { limit?: string } }>('/api/continue', async req => {
    const limit = Math.min(Math.max(Number.parseInt((req.query.limit ?? '20').toString(), 10) || 20, 1), 100);
    const rows = db.prepare<[number], RecentRow>(`
      SELECT v.id, v.display_title, v.duration_sec,
        CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
        v.folder_id,
        p.position_seconds, p.duration_seconds, p.watched, p.updated_at
      FROM progress p JOIN videos v ON v.id = p.video_id
      WHERE p.watched = 0 AND p.position_seconds > 30
      ORDER BY p.updated_at DESC
      LIMIT ?
    `).all(limit);
    return { items: rows.map(shapeRow) };
  });
}
