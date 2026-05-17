PRAGMA foreign_keys = ON;

CREATE TABLE folders (
  id           INTEGER PRIMARY KEY,
  parent_id    INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  rel_path     TEXT NOT NULL UNIQUE,
  depth        INTEGER NOT NULL,
  sort_key     TEXT NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_folders_parent ON folders(parent_id);

CREATE TABLE videos (
  id            INTEGER PRIMARY KEY,
  folder_id     INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  display_title TEXT NOT NULL,
  episode_num   INTEGER,
  rel_path      TEXT NOT NULL UNIQUE,
  content_key   TEXT NOT NULL UNIQUE,
  size_bytes    INTEGER NOT NULL,
  mtime_ms      INTEGER NOT NULL,
  duration_sec  REAL,
  thumb_path    TEXT,
  scan_status   TEXT NOT NULL DEFAULT 'pending',
  scan_error    TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_videos_folder ON videos(folder_id);
CREATE INDEX idx_videos_status ON videos(scan_status);

CREATE TABLE progress (
  video_id         INTEGER PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL,
  watched          INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_progress_updated ON progress(updated_at DESC);

CREATE TABLE favorites (
  video_id   INTEGER PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE VIRTUAL TABLE search_index USING fts5(
  kind UNINDEXED,
  ref_id UNINDEXED,
  title,
  path,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO schema_meta(key, value) VALUES ('version', '1');
