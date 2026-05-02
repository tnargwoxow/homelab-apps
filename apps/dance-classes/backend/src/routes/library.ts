import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface FolderRow {
  id: number;
  parent_id: number | null;
  name: string;
  display_name: string;
  rel_path: string;
  depth: number;
}

interface VideoListRow {
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

interface ChildFolderRow {
  id: number;
  display_name: string;
  rel_path: string;
  child_count: number;
}

const SAMPLE_THUMB_LIMIT = 4;

function sampleFolderThumbIds(db: DB, folderId: number): number[] {
  // Pick up to N video ids with thumbs from this folder or any descendant folder.
  // Stable pseudo-random across folder ids so the mosaic doesn't change on every refresh.
  const rows = db.prepare<[number, number], { id: number }>(`
    WITH RECURSIVE descendants(id) AS (
      SELECT ?
      UNION ALL
      SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
    )
    SELECT v.id FROM videos v
    JOIN descendants d ON v.folder_id = d.id
    WHERE v.thumb_path IS NOT NULL
    ORDER BY (v.id * 2654435761) % 1000003, v.id
    LIMIT ?
  `).all(folderId, SAMPLE_THUMB_LIMIT);
  return rows.map(r => r.id);
}

function buildBreadcrumb(db: DB, folderId: number): Array<{ id: number; name: string }> {
  const stmt = db.prepare<[number], { id: number; parent_id: number | null; display_name: string }>(
    'SELECT id, parent_id, display_name FROM folders WHERE id = ?'
  );
  const out: Array<{ id: number; name: string }> = [];
  let id: number | null = folderId;
  while (id !== null) {
    const row = stmt.get(id);
    if (!row) break;
    // Skip the synthetic root folder; the UI provides a "Library" anchor of its own.
    if (row.parent_id !== null) {
      out.unshift({ id: row.id, name: row.display_name });
    }
    id = row.parent_id;
  }
  return out;
}

function getFolderPayload(db: DB, folderId: number) {
  const folder = db.prepare<[number], FolderRow>(
    'SELECT id, parent_id, name, display_name, rel_path, depth FROM folders WHERE id = ?'
  ).get(folderId);
  if (!folder) return null;

  const children = db.prepare<[number], ChildFolderRow>(`
    SELECT f.id, f.display_name, f.rel_path,
      (SELECT COUNT(*) FROM videos v WHERE v.folder_id = f.id) +
      (SELECT COUNT(*) FROM folders f2 WHERE f2.parent_id = f.id) AS child_count
    FROM folders f
    WHERE f.parent_id = ?
    ORDER BY f.sort_key ASC
  `).all(folderId);

  const videos = db.prepare<[number], VideoListRow>(`
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
    FROM videos v
    LEFT JOIN progress p ON p.video_id = v.id
    LEFT JOIN favorites fav ON fav.video_id = v.id
    WHERE v.folder_id = ?
    ORDER BY (v.episode_num IS NULL), v.episode_num ASC, v.filename ASC
  `).all(folderId);

  return {
    folder: {
      id: folder.id,
      name: folder.display_name,
      relPath: folder.rel_path,
      parentId: folder.parent_id
    },
    breadcrumb: buildBreadcrumb(db, folderId),
    folders: children.map(c => ({
      id: c.id,
      name: c.display_name,
      childCount: c.child_count,
      thumbVideoIds: sampleFolderThumbIds(db, c.id)
    })),
    videos: videos.map(v => ({
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
}

export async function registerLibraryRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.get('/api/folders/root', async (_req, reply) => {
    const root = db.prepare<[], { id: number }>(
      "SELECT id FROM folders WHERE rel_path = '' ORDER BY id ASC LIMIT 1"
    ).get();
    if (!root) {
      return { folder: { id: null, name: 'Library', relPath: '', parentId: null }, breadcrumb: [], folders: [], videos: [] };
    }
    const payload = getFolderPayload(db, root.id);
    if (!payload) return reply.code(500).send({ error: 'Root not found' });
    return payload;
  });

  app.get<{ Params: { id: string } }>('/api/folders/:id', async (req, reply) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad folder id' });
    const payload = getFolderPayload(db, id);
    if (!payload) return reply.code(404).send({ error: 'Folder not found' });
    return payload;
  });
}
