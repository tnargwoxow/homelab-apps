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

await app.register(registerLibraryRoutes, { db });
await app.register(registerVideoRoutes, { db, config });
await app.register(registerProgressRoutes, { db });
await app.register(registerFavoriteRoutes, { db });
await app.register(registerSearchRoutes, { db });
await app.register(registerRecentRoutes, { db });
await app.register(registerCastRoutes, { db });

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
  startCast(app.log);
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}

// touch path to silence unused-import warning when types are checked
void path;
