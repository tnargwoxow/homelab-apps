import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { openDb, runMigrations, closeDb } from './db/index.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerVideoRoutes } from './routes/videos.js';
import { registerProgressRoutes } from './routes/progress.js';
import { registerFavoriteRoutes } from './routes/favorites.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerRecentRoutes } from './routes/recent.js';
import { registerCastRoutes } from './routes/cast.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerPlaylistRoutes } from './routes/playlists.js';
import { startScanner, stopScanner, getStatus, triggerRescan } from './scanner/index.js';
import { startCast, stopCast } from './cast/index.js';

const config = loadConfig();

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.thumbDir, { recursive: true });

const db = openDb(config.dbPath);
runMigrations(db);

const app = Fastify({
  logger: { level: config.logLevel },
  trustProxy: true,
  bodyLimit: 1024 * 64
});

app.get('/healthz', async () => ({ ok: true }));

app.get('/api/library/status', async () => getStatus(db));
app.post('/api/library/rescan', async () => {
  triggerRescan();
  return { ok: true };
});

interface ErrorRow {
  id: number;
  rel_path: string;
  filename: string;
  display_title: string;
  folder_id: number;
  scan_error: string | null;
  scan_error_ignored: number;
  updated_at: number;
}
app.get<{ Querystring: { includeIgnored?: string } }>('/api/library/errors', async req => {
  const includeIgnored = req.query?.includeIgnored === '1' || req.query?.includeIgnored === 'true';
  const sql = `
    SELECT id, rel_path, filename, display_title, folder_id, scan_error, scan_error_ignored, updated_at
    FROM videos
    WHERE scan_status = 'error' ${includeIgnored ? '' : 'AND scan_error_ignored = 0'}
    ORDER BY scan_error_ignored ASC, updated_at DESC
    LIMIT 200
  `;
  const rows = db.prepare<[], ErrorRow>(sql).all();
  return {
    items: rows.map(r => ({
      id: r.id,
      relPath: r.rel_path,
      filename: r.filename,
      title: r.display_title,
      folderId: r.folder_id,
      error: r.scan_error,
      ignored: !!r.scan_error_ignored,
      updatedAt: r.updated_at
    }))
  };
});

// Ignore: keep the row's scan_status='error' but stop showing it in the
// errors badge and modal. Idempotent.
app.post<{ Params: { id: string } }>('/api/library/errors/:id/ignore', async (req, reply) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
  db.prepare(
    "UPDATE videos SET scan_error_ignored = 1, updated_at = unixepoch() WHERE id = ? AND scan_status = 'error'"
  ).run(id);
  return { ok: true };
});

// Restore: bring the error back into view.
app.post<{ Params: { id: string } }>('/api/library/errors/:id/restore', async (req, reply) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
  db.prepare(
    "UPDATE videos SET scan_error_ignored = 0, updated_at = unixepoch() WHERE id = ?"
  ).run(id);
  return { ok: true };
});

// Retry: flip the row back to 'pending' so the scanner queue picks it up
// again on the next pump tick. Useful after fixing the underlying issue
// (re-encoded the file, replaced it, etc.).
app.post<{ Params: { id: string } }>('/api/library/errors/:id/retry', async (req, reply) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Bad video id' });
  db.prepare(
    "UPDATE videos SET scan_status = 'pending', scan_error = NULL, scan_error_ignored = 0, updated_at = unixepoch() WHERE id = ?"
  ).run(id);
  return { ok: true };
});

await app.register(registerLibraryRoutes, { db });
await app.register(registerVideoRoutes, { db, config });
await app.register(registerProgressRoutes, { db });
await app.register(registerFavoriteRoutes, { db });
await app.register(registerSearchRoutes, { db });
await app.register(registerRecentRoutes, { db });
await app.register(registerCastRoutes, { db });
await app.register(registerStatsRoutes, { db });
await app.register(registerPlaylistRoutes, { db });

const publicDirExists = fs.existsSync(config.publicDir);
if (publicDirExists) {
  await app.register(fastifyStatic, {
    root: config.publicDir,
    prefix: '/',
    decorateReply: false,
    index: ['index.html']
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/healthz')) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    reply.type('text/html').sendFile('index.html');
  });
} else {
  app.log.warn(`Public dir ${config.publicDir} does not exist; serving API only`);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  try {
    await stopScanner();
    stopCast();
    await app.close();
    closeDb(db);
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'shutdown error');
    process.exit(1);
  }
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ videosDir: config.videosDir, dataDir: config.dataDir }, 'server listening');
  startScanner({ db, videosDir: config.videosDir, thumbDir: config.thumbDir, probeConcurrency: config.probeConcurrency, thumbConcurrency: config.thumbConcurrency, logger: app.log });
  startCast(app.log, db);
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}

// touch path to silence unused-import warning when types are checked
void path;
