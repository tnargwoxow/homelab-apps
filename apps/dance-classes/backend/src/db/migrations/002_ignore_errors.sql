-- Allow the user to dismiss specific scanner errors so they stop showing
-- up in the "errors: N" badge and the errors modal. Default 0 keeps every
-- existing errored row visible after the migration runs.

ALTER TABLE videos ADD COLUMN scan_error_ignored INTEGER NOT NULL DEFAULT 0;

-- Composite index so the "visible errors" filter is cheap. Most rows have
-- scan_status='ready', so a partial-ish two-column index is plenty.
CREATE INDEX idx_videos_error_visible
  ON videos(scan_status, scan_error_ignored);
