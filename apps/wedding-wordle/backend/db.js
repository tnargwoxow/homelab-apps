import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDb() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, 'wordle.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      started_at   INTEGER,
      finished_at  INTEGER,
      current_word INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      solved_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS guesses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id  TEXT NOT NULL,
      word_index INTEGER NOT NULL,
      guess      TEXT NOT NULL,
      result     TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_guesses_player_word
      ON guesses(player_id, word_index);
  `);

  return db;
}
