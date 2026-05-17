import path from 'node:path';

function readEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Required env var ${key} is not set`);
}

function readInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`Env var ${key} must be an integer (got "${raw}")`);
  return n;
}

export interface Config {
  videosDir: string;
  dataDir: string;
  thumbDir: string;
  dbPath: string;
  port: number;
  host: string;
  publicDir: string;
  thumbConcurrency: number;
  probeConcurrency: number;
  logLevel: string;
}

export function loadConfig(): Config {
  const videosDir = path.resolve(readEnv('VIDEOS_DIR', '/videos'));
  const dataDir = path.resolve(readEnv('DATA_DIR', '/data'));
  return {
    videosDir,
    dataDir,
    thumbDir: path.join(dataDir, 'thumbs'),
    dbPath: path.join(dataDir, 'library.db'),
    port: readInt('PORT', 8080),
    host: readEnv('HOST', '0.0.0.0'),
    publicDir: path.resolve(readEnv('PUBLIC_DIR', path.join(process.cwd(), 'public'))),
    thumbConcurrency: readInt('THUMB_CONCURRENCY', 1),
    probeConcurrency: readInt('PROBE_CONCURRENCY', 2),
    logLevel: readEnv('LOG_LEVEL', 'info')
  };
}
