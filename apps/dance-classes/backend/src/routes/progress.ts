import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface ProgressBody {
  position: number;
  duration?: number;
}

interface WatchedBody {
  watched: boolean;
}

export async function registerProgressRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.post<{ Params: { id: string }; Body: ProgressBody }>(
    '/api/videos/:id/progress',
    async (req, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
      const body = req.body ?? ({} as ProgressBody);
      const position = Number(body.position);
      if (!Number.isFinite(position) || position < 0) return reply.code(400).send({ error: 'Bad position' });
      const duration = Number(body.duration);
      const dur = Number.isFinite(duration) && duration > 0 ? duration : null;

      const exists = db.prepare<[number], { id: number }>('SELECT id FROM videos WHERE id = ?').get(id);
      if (!exists) return reply.code(404).send({ error: 'Video not found' });

      // Watched is only ever set by the explicit /watched endpoint or the
      // 'ended' / cast 'finished' events. Saving progress (including from
      // scrubbing past 90%) doesn't flip it on its own.
      db.prepare(`
        INSERT INTO progress(video_id, position_seconds, duration_seconds, watched, updated_at)
        VALUES (?, ?, ?, 0, unixepoch())
        ON CONFLICT(video_id) DO UPDATE SET
          position_seconds = excluded.position_seconds,
          duration_seconds = COALESCE(excluded.duration_seconds, progress.duration_seconds),
          updated_at = unixepoch()
      `).run(id, position, dur);

      return { ok: true };
    }
  );

  app.post<{ Params: { id: string }; Body: WatchedBody }>(
    '/api/videos/:id/watched',
    async (req, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
      const body = req.body ?? ({} as WatchedBody);
      const watched = body.watched ? 1 : 0;
      const row = db.prepare<[number], { id: number; duration_sec: number | null }>(
        'SELECT id, duration_sec FROM videos WHERE id = ?'
      ).get(id);
      if (!row) return reply.code(404).send({ error: 'Video not found' });

      if (watched) {
        // Marking watched should look identical in stats to letting the video
        // play to its natural end: position == duration so the row passes the
        // `position_seconds > 30` filter in /api/stats and contributes the
        // full duration to watch-time. If the video hasn't been probed yet,
        // fall back to a sentinel of 60s so the row still counts.
        const dur = row.duration_sec && row.duration_sec > 0 ? row.duration_sec : 60;
        db.prepare(`
          INSERT INTO progress(video_id, watched, position_seconds, duration_seconds, updated_at)
          VALUES (?, 1, ?, ?, unixepoch())
          ON CONFLICT(video_id) DO UPDATE SET
            watched          = 1,
            position_seconds = MAX(progress.position_seconds, excluded.position_seconds),
            duration_seconds = COALESCE(excluded.duration_seconds, progress.duration_seconds),
            updated_at       = unixepoch()
        `).run(id, dur, row.duration_sec);
      } else {
        // Un-marking just flips the flag; preserve any saved scrub position.
        db.prepare(`
          INSERT INTO progress(video_id, watched, position_seconds, updated_at)
          VALUES (?, 0, 0, unixepoch())
          ON CONFLICT(video_id) DO UPDATE SET
            watched    = 0,
            updated_at = unixepoch()
        `).run(id);
      }
      return { ok: true, watched: !!watched };
    }
  );

  // Reset progress for a video — removes it from Continue Watching /
  // Recently Played. Idempotent: returns ok even if there was nothing
  // to remove.
  app.delete<{ Params: { id: string } }>(
    '/api/videos/:id/progress',
    async (req, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
      db.prepare('DELETE FROM progress WHERE video_id = ?').run(id);
      return { ok: true };
    }
  );
}
