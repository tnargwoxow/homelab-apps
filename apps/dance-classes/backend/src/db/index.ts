import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DB = Database.Database;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function openDb(dbPath: string): DB {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function closeDb(db: DB): void {
  db.close();
}

export function runMigrations(db: DB): void {
  const hasMeta = db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'")
    .get();
  const currentVersion = hasMeta
    ? Number(
        (db.prepare("SELECT value FROM schema_meta WHERE key='version'").get() as { value: string } | undefined)
          ?.value ?? 0
      )
    : 0;

  // Resolve migrations dir whether running from src/ (tsx) or dist/
  let migrationsDir = MIGRATIONS_DIR;
  if (!fs.existsSync(migrationsDir)) {
    const fallback = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
    if (fs.existsSync(fallback)) migrationsDir = fallback;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const match = /^(\d+)_/.exec(file);
    if (!match) continue;
    const version = Number(match[1]);
    if (version <= currentVersion) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_meta(key,value) VALUES('version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).run(String(version));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
