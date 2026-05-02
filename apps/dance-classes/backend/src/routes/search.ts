import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface SearchRow {
  kind: string;
  ref_id: number;
  title: string;
  path: string;
  snippet: string;
}

interface VideoExtra {
  duration_sec: number | null;
  has_thumb: number;
  folder_id: number;
  position_seconds: number | null;
  watched: number | null;
}

interface FolderExtra {
  display_name: string;
  parent_id: number | null;
}

function escapeFtsTerm(raw: string): string {
  // Tokenize loosely, quote each token to avoid FTS5 syntax errors with stray punctuation.
  const tokens = raw
    .split(/\s+/)
    .map(t => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(t => t.length > 0)
    .map(t => `"${t}"*`);
  if (tokens.length === 0) return '';
  return tokens.join(' ');
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.get<{ Querystring: { q?: string; limit?: string } }>('/api/search', async (req, reply) => {
    const q = (req.query.q ?? '').toString().trim();
    const limit = Math.min(Math.max(Number.parseInt((req.query.limit ?? '50').toString(), 10) || 50, 1), 200);
    if (!q) return { items: [] };

    const ftsExpr = escapeFtsTerm(q);
    if (!ftsExpr) return { items: [] };

    let rows: SearchRow[];
    try {
      rows = db.prepare<[string, number], SearchRow>(`
        SELECT kind, ref_id, title, path,
          snippet(search_index, 2, '<mark>', '</mark>', '…', 8) AS snippet
        FROM search_index
        WHERE search_index MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(ftsExpr, limit);
    } catch (err) {
      reply.code(400);
      return { error: String((err as Error).message ?? err) };
    }

    const videoIds = rows.filter(r => r.kind === 'video').map(r => r.ref_id);
    const folderIds = rows.filter(r => r.kind === 'folder').map(r => r.ref_id);

    const videoExtras = new Map<number, VideoExtra>();
    if (videoIds.length > 0) {
      const placeholders = videoIds.map(() => '?').join(',');
      const stmt = db.prepare<unknown[], VideoExtra & { id: number }>(`
        SELECT v.id,
          v.duration_sec,
          CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
          v.folder_id,
          p.position_seconds, p.watched
        FROM videos v LEFT JOIN progress p ON p.video_id = v.id
        WHERE v.id IN (${placeholders})
      `);
      for (const r of stmt.all(...videoIds)) videoExtras.set(r.id, r);
    }

    const folderExtras = new Map<number, FolderExtra>();
    if (folderIds.length > 0) {
      const placeholders = folderIds.map(() => '?').join(',');
      const stmt = db.prepare<unknown[], FolderExtra & { id: number }>(`
        SELECT id, display_name, parent_id FROM folders WHERE id IN (${placeholders})
      `);
      for (const r of stmt.all(...folderIds)) folderExtras.set(r.id, r);
    }

    return {
      items: rows.map(r => {
        if (r.kind === 'video') {
          const extra = videoExtras.get(r.ref_id);
          return {
            kind: 'video' as const,
            id: r.ref_id,
            title: r.title,
            path: r.path,
            snippet: r.snippet,
            durationSec: extra?.duration_sec ?? null,
            hasThumb: !!extra?.has_thumb,
            folderId: extra?.folder_id ?? null,
            position: extra?.position_seconds ?? 0,
            watched: !!extra?.watched
          };
        }
        return {
          kind: 'folder' as const,
          id: r.ref_id,
          title: r.title,
          path: r.path,
          snippet: r.snippet
        };
      })
    };
  });
}
