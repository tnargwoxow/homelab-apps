import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DB } from '../db/index.js';
import { isVideoFile, parseVideoFilename, parseFolderName } from '../lib/titleParser.js';

export interface WalkSummary {
  folders: number;
  videos: number;
  added: number;
  removed: number;
}

interface FolderRow {
  id: number;
  rel_path: string;
}

interface VideoRow {
  id: number;
  rel_path: string;
  size_bytes: number;
  mtime_ms: number;
}

function relPathFromAbs(rootDir: string, abs: string): string {
  const rel = path.relative(rootDir, abs);
  return rel.split(path.sep).join('/');
}

function contentKey(relPath: string): string {
  return crypto.createHash('sha1').update(relPath).digest('hex');
}

function ensureFolder(
  db: DB,
  rootDir: string,
  absDir: string,
  folderCache: Map<string, number>
): number {
  if (absDir === rootDir) {
    const rootRel = '';
    const cached = folderCache.get(rootRel);
    if (cached !== undefined) return cached;
    const existing = db.prepare<[string], { id: number }>(
      'SELECT id FROM folders WHERE rel_path = ?'
    ).get(rootRel);
    if (existing) {
      folderCache.set(rootRel, existing.id);
      return existing.id;
    }
    const info = db.prepare(
      'INSERT INTO folders(parent_id,name,display_name,rel_path,depth,sort_key) VALUES (NULL,?,?,?,0,?)'
    ).run('', 'Library', rootRel, '');
    const id = Number(info.lastInsertRowid);
    folderCache.set(rootRel, id);
    return id;
  }

  const rel = relPathFromAbs(rootDir, absDir);
  const cached = folderCache.get(rel);
  if (cached !== undefined) return cached;

  const parentAbs = path.dirname(absDir);
  const parentId = ensureFolder(db, rootDir, parentAbs, folderCache);

  const existing = db.prepare<[string], { id: number }>(
    'SELECT id FROM folders WHERE rel_path = ?'
  ).get(rel);
  if (existing) {
    folderCache.set(rel, existing.id);
    return existing.id;
  }

  const name = path.basename(absDir);
  const display = parseFolderName(name);
  const depth = rel.split('/').length;
  const sortKey = display.toLowerCase();
  const info = db.prepare(
    'INSERT INTO folders(parent_id,name,display_name,rel_path,depth,sort_key) VALUES (?,?,?,?,?,?)'
  ).run(parentId, name, display, rel, depth, sortKey);
  const id = Number(info.lastInsertRowid);
  folderCache.set(rel, id);

  // FTS row for folder
  db.prepare(
    "INSERT INTO search_index(kind,ref_id,title,path) VALUES('folder',?,?,?)"
  ).run(id, display, rel);

  return id;
}

export async function walkLibrary(db: DB, rootDir: string): Promise<WalkSummary> {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Videos dir does not exist: ${rootDir}`);
  }

  const folderCache = new Map<string, number>();
  const seenVideoPaths = new Set<string>();
  const seenFolderPaths = new Set<string>();
  seenFolderPaths.add('');
  ensureFolder(db, rootDir, rootDir, folderCache);

  let folderCount = 1;
  let videoCount = 0;
  let added = 0;

  const upsertVideo = db.prepare(
    `INSERT INTO videos(folder_id,filename,display_title,episode_num,rel_path,content_key,size_bytes,mtime_ms,scan_status,updated_at)
     VALUES(?,?,?,?,?,?,?,?,'pending',unixepoch())
     ON CONFLICT(rel_path) DO UPDATE SET
       size_bytes = excluded.size_bytes,
       mtime_ms = excluded.mtime_ms,
       updated_at = unixepoch(),
       scan_status = CASE
         WHEN videos.mtime_ms <> excluded.mtime_ms OR videos.size_bytes <> excluded.size_bytes
         THEN 'pending'
         ELSE videos.scan_status
       END,
       thumb_path = CASE
         WHEN videos.mtime_ms <> excluded.mtime_ms OR videos.size_bytes <> excluded.size_bytes
         THEN NULL
         ELSE videos.thumb_path
       END
     RETURNING id, (SELECT changes()) AS changed`
  );

  const findVideo = db.prepare<[string], { id: number }>(
    'SELECT id FROM videos WHERE rel_path = ?'
  );

  const insertVideoFts = db.prepare(
    "INSERT INTO search_index(kind,ref_id,title,path) VALUES('video',?,?,?)"
  );

  const walk = (absDir: string) => {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        const folderId = ensureFolder(db, rootDir, full, folderCache);
        seenFolderPaths.add(relPathFromAbs(rootDir, full));
        folderCount++;
        void folderId;
        walk(full);
      } else if (entry.isFile()) {
        if (!isVideoFile(entry.name)) continue;
        const stat = fs.statSync(full);
        const rel = relPathFromAbs(rootDir, full);
        seenVideoPaths.add(rel);
        videoCount++;

        const folderId = ensureFolder(db, rootDir, absDir, folderCache);
        const parsed = parseVideoFilename(entry.name);
        const before = findVideo.get(rel);
        upsertVideo.run(
          folderId,
          entry.name,
          parsed.displayTitle,
          parsed.episodeNum,
          rel,
          contentKey(rel),
          stat.size,
          stat.mtimeMs
        );
        if (!before) {
          const row = findVideo.get(rel);
          if (row) {
            insertVideoFts.run(row.id, parsed.displayTitle, rel);
            added++;
          }
        }
      }
    }
  };

  const tx = db.transaction(() => walk(rootDir));
  tx();

  // Reconcile: drop rows for files/folders no longer on disk
  const allVideos = db.prepare<[], VideoRow>('SELECT id, rel_path FROM videos').all();
  const removeVideo = db.prepare('DELETE FROM videos WHERE id = ?');
  const removeVideoFts = db.prepare("DELETE FROM search_index WHERE kind='video' AND ref_id = ?");
  let removed = 0;
  for (const v of allVideos) {
    if (!seenVideoPaths.has(v.rel_path)) {
      removeVideo.run(v.id);
      removeVideoFts.run(v.id);
      removed++;
    }
  }
  const allFolders = db.prepare<[], FolderRow>('SELECT id, rel_path FROM folders').all();
  const removeFolder = db.prepare('DELETE FROM folders WHERE id = ?');
  const removeFolderFts = db.prepare("DELETE FROM search_index WHERE kind='folder' AND ref_id = ?");
  for (const f of allFolders) {
    if (f.rel_path === '') continue;
    if (!seenFolderPaths.has(f.rel_path)) {
      removeFolder.run(f.id);
      removeFolderFts.run(f.id);
    }
  }

  return { folders: folderCount, videos: videoCount, added, removed };
}
