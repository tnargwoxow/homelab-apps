import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface FavoriteRow {
  id: number;
  display_title: string;
  duration_sec: number | null;
  has_thumb: number;
  folder_id: number;
  created_at: number;
  position_seconds: number | null;
  watched: number | null;
}

export async function registerFavoriteRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.get('/api/favorites', async () => {
    const rows = db.prepare<[], FavoriteRow>(`
      SELECT
        v.id, v.display_title, v.duration_sec,
        CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
        v.folder_id, fav.created_at,
        p.position_seconds, p.watched
      FROM favorites fav
      JOIN videos v ON v.id = fav.video_id
      LEFT JOIN progress p ON p.video_id = v.id
      ORDER BY fav.created_at DESC
    `).all();
    return {
      items: rows.map(r => ({
        id: r.id,
        title: r.display_title,
        durationSec: r.duration_sec,
        hasThumb: !!r.has_thumb,
        folderId: r.folder_id,
        createdAt: r.created_at,
        position: r.position_seconds ?? 0,
        watched: !!r.watched
      }))
    };
  });

  app.post<{ Params: { videoId: string } }>('/api/favorites/:videoId', async (req, reply) => {
    const id = Number.parseInt(req.params.videoId, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
    const exists = db.prepare<[number], { id: number }>('SELECT id FROM videos WHERE id = ?').get(id);
    if (!exists) return reply.code(404).send({ error: 'Video not found' });
    db.prepare('INSERT OR IGNORE INTO favorites(video_id) VALUES (?)').run(id);
    return { ok: true, favorite: true };
  });

  app.delete<{ Params: { videoId: string } }>('/api/favorites/:videoId', async (req, reply) => {
    const id = Number.parseInt(req.params.videoId, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
    db.prepare('DELETE FROM favorites WHERE video_id = ?').run(id);
    return { ok: true, favorite: false };
  });
}
