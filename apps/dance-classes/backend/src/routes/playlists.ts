import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface PlaylistSummaryRow {
  id: number;
  name: string;
  item_count: number;
  total_seconds: number | null;
  updated_at: number;
}

interface PlaylistRow {
  id: number;
  name: string;
  updated_at: number;
}

interface PlaylistVideoRow {
  id: number;
  display_title: string;
  episode_num: number | null;
  filename: string;
  duration_sec: number | null;
  has_thumb: number;
  scan_status: string;
  position_seconds: number | null;
  watched: number | null;
  is_favorite: number;
}

interface NameBody     { name?: string }
interface ItemBody     { videoId?: number; position?: number }
interface ReorderBody  { from?: number; to?: number }

export async function registerPlaylistRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------
  app.get('/api/playlists', async () => {
    const rows = db.prepare<[], PlaylistSummaryRow>(`
      SELECT
        p.id,
        p.name,
        p.updated_at,
        COUNT(pi.video_id)              AS item_count,
        COALESCE(SUM(v.duration_sec),0) AS total_seconds
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      LEFT JOIN videos v          ON v.id = pi.video_id
      GROUP BY p.id
      ORDER BY p.updated_at DESC, p.id DESC
    `).all();

    return {
      playlists: rows.map(r => ({
        id: r.id,
        name: r.name,
        itemCount: r.item_count,
        totalSeconds: r.total_seconds ?? 0,
        updatedAt: r.updated_at
      }))
    };
  });

  app.post<{ Body: NameBody }>('/api/playlists', async (req, reply) => {
    const name = (req.body?.name ?? '').trim();
    if (!name) return reply.code(400).send({ error: 'name required' });
    const info = db.prepare('INSERT INTO playlists(name) VALUES (?)').run(name);
    return { id: Number(info.lastInsertRowid), name };
  });

  // ---------------------------------------------------------------------------
  // Single playlist
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/playlists/:id', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'bad playlist id' });
    const playlist = db.prepare<[number], PlaylistRow>(
      'SELECT id, name, updated_at FROM playlists WHERE id = ?'
    ).get(id);
    if (!playlist) return reply.code(404).send({ error: 'Playlist not found' });

    const items = db.prepare<[number], PlaylistVideoRow>(`
      SELECT
        v.id,
        v.display_title,
        v.episode_num,
        v.filename,
        v.duration_sec,
        CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
        v.scan_status,
        p.position_seconds,
        p.watched,
        CASE WHEN fav.video_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
      FROM playlist_items pi
      JOIN videos v             ON v.id = pi.video_id
      LEFT JOIN progress p      ON p.video_id = v.id
      LEFT JOIN favorites fav   ON fav.video_id = v.id
      WHERE pi.playlist_id = ?
      ORDER BY pi.position ASC
    `).all(id);

    return {
      id: playlist.id,
      name: playlist.name,
      updatedAt: playlist.updated_at,
      items: items.map(v => ({
        id: v.id,
        title: v.display_title,
        episodeNum: v.episode_num,
        filename: v.filename,
        durationSec: v.duration_sec,
        hasThumb: !!v.has_thumb,
        scanStatus: v.scan_status,
        position: v.position_seconds ?? 0,
        watched: !!v.watched,
        favorite: !!v.is_favorite
      }))
    };
  });

  app.put<{ Params: { id: string }; Body: NameBody }>('/api/playlists/:id', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'bad playlist id' });
    const name = (req.body?.name ?? '').trim();
    if (!name) return reply.code(400).send({ error: 'name required' });
    const info = db
      .prepare('UPDATE playlists SET name = ?, updated_at = unixepoch() WHERE id = ?')
      .run(name, id);
    if (info.changes === 0) return reply.code(404).send({ error: 'Playlist not found' });
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/playlists/:id', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'bad playlist id' });
    const info = db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
    if (info.changes === 0) return reply.code(404).send({ error: 'Playlist not found' });
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: ItemBody }>(
    '/api/playlists/:id/items',
    async (req, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'bad playlist id' });
      const { videoId, position } = req.body ?? ({} as ItemBody);
      if (!Number.isFinite(videoId)) return reply.code(400).send({ error: 'videoId required' });

      const playlist = db.prepare<[number], { id: number }>('SELECT id FROM playlists WHERE id = ?').get(id);
      if (!playlist) return reply.code(404).send({ error: 'Playlist not found' });

      const video = db.prepare<[number], { id: number }>('SELECT id FROM videos WHERE id = ?').get(videoId!);
      if (!video) return reply.code(400).send({ error: 'videoId does not exist' });

      const insert = db.transaction((targetPos: number | null) => {
        const max = (db
          .prepare<[number], { mx: number | null }>(
            'SELECT MAX(position) AS mx FROM playlist_items WHERE playlist_id = ?'
          )
          .get(id)?.mx) ?? -1;

        let pos: number;
        if (targetPos === null || targetPos === undefined || !Number.isFinite(targetPos)) {
          pos = max + 1;
        } else {
          pos = Math.max(0, Math.min(targetPos, max + 1));
          if (pos <= max) {
            // Shift everything at or beyond `pos` up by one. SQLite's stock
            // build doesn't support UPDATE ... ORDER BY, so we use a two-step
            // park-and-restore: move into a unique negative slot first, then
            // back to the final +1 position. -1000000 - position is unique
            // because input positions are non-negative.
            db.prepare(`
              UPDATE playlist_items
              SET position = -1000000 - position
              WHERE playlist_id = ? AND position >= ?
            `).run(id, pos);
            db.prepare(`
              UPDATE playlist_items
              SET position = (-position - 1000000) + 1
              WHERE playlist_id = ? AND position <= -1000000
            `).run(id);
          }
        }
        db.prepare('INSERT INTO playlist_items(playlist_id, video_id, position) VALUES (?, ?, ?)')
          .run(id, videoId, pos);
        db.prepare('UPDATE playlists SET updated_at = unixepoch() WHERE id = ?').run(id);
        return pos;
      });

      const finalPos = insert(position ?? null);
      return { ok: true, position: finalPos };
    }
  );

  app.delete<{ Params: { id: string; position: string } }>(
    '/api/playlists/:id/items/:position',
    async (req, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const pos = Number.parseInt(req.params.position, 10);
      if (!Number.isFinite(id) || !Number.isFinite(pos)) {
        return reply.code(400).send({ error: 'bad playlist id or position' });
      }
      const tx = db.transaction(() => {
        const info = db
          .prepare('DELETE FROM playlist_items WHERE playlist_id = ? AND position = ?')
          .run(id, pos);
        if (info.changes === 0) return false;
        db.prepare(`
          UPDATE playlist_items
          SET position = position - 1
          WHERE playlist_id = ? AND position > ?
        `).run(id, pos);
        db.prepare('UPDATE playlists SET updated_at = unixepoch() WHERE id = ?').run(id);
        return true;
      });
      const ok = tx();
      if (!ok) return reply.code(404).send({ error: 'Item not found' });
      return { ok: true };
    }
  );

  app.put<{ Params: { id: string }; Body: ReorderBody }>(
    '/api/playlists/:id/items/reorder',
    async (req, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const { from, to } = req.body ?? ({} as ReorderBody);
      if (!Number.isFinite(id) || !Number.isFinite(from) || !Number.isFinite(to)) {
        return reply.code(400).send({ error: 'id, from, to required' });
      }
      if (from === to) return { ok: true };

      const tx = db.transaction(() => {
        const row = db
          .prepare<[number, number], { video_id: number }>(
            'SELECT video_id FROM playlist_items WHERE playlist_id = ? AND position = ?'
          )
          .get(id, from!);
        if (!row) return false;

        const max = (db
          .prepare<[number], { mx: number | null }>(
            'SELECT MAX(position) AS mx FROM playlist_items WHERE playlist_id = ?'
          )
          .get(id)?.mx) ?? -1;
        const target = Math.max(0, Math.min(to!, max));

        // Park the moving row at a temp negative slot so the shift below
        // doesn't collide with its current (playlist, position) PK.
        db.prepare(
          'UPDATE playlist_items SET position = -1 WHERE playlist_id = ? AND position = ?'
        ).run(id, from!);

        if (target > from!) {
          db.prepare(`
            UPDATE playlist_items
            SET position = position - 1
            WHERE playlist_id = ? AND position > ? AND position <= ?
          `).run(id, from!, target);
        } else {
          // Stock SQLite has no UPDATE ... ORDER BY, so we two-step the
          // shift via temporary negative slots to avoid colliding with the
          // (playlist_id, position) primary key mid-update.
          db.prepare(`
            UPDATE playlist_items
            SET position = -1000000 - position
            WHERE playlist_id = ? AND position >= ? AND position < ?
          `).run(id, target, from!);
          db.prepare(`
            UPDATE playlist_items
            SET position = (-position - 1000000) + 1
            WHERE playlist_id = ? AND position <= -1000000
          `).run(id);
        }

        db.prepare(
          'UPDATE playlist_items SET position = ? WHERE playlist_id = ? AND position = -1'
        ).run(target, id);
        db.prepare('UPDATE playlists SET updated_at = unixepoch() WHERE id = ?').run(id);
        return true;
      });

      const ok = tx();
      if (!ok) return reply.code(404).send({ error: 'Item not found at from' });
      return { ok: true };
    }
  );
}
