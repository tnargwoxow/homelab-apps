# Mimi's Dance Wonderland

A self-hosted, ballet-themed streaming web app for a folder-organized library of dance class videos. Browse nested folders, search across the library, resume where you left off on every video, mark favorites, and see what you watched recently.

Designed to run on a low-power Proxmox VM. Direct HTTP byte-range streaming, no transcoding. ffmpeg is only used to generate one thumbnail per video, on a queue.

## Features

- Nested folder browsing with breadcrumb navigation
- Full-text search over titles and folders (SQLite FTS5)
- Resume position per video (auto-saved + survives tab close via `sendBeacon`)
- Watched marker (auto at >=90%, manual override)
- Favorites and recently played
- Auto-play next lesson with countdown overlay
- Playback speed (1x / 1.25x / 1.5x / 2x)
- Keyboard shortcuts (Space, J/L, arrows, F, M, 0-9, etc.)
- Cute pastel ballet theme with mascots
- LAN-only; no auth

## Quick start

1. `cp .env.example .env` and set `VIDEOS_HOST_PATH` to the absolute path of your video library on the host.
2. `docker compose up --build -d`
3. Open `http://<host-ip>:8080`.

## Configuration

| Var | Default | Notes |
|---|---|---|
| `VIDEOS_HOST_PATH` | _(required)_ | Host path mounted read-only at `/videos` |
| `PORT` | `8080` | Container port |
| `THUMB_CONCURRENCY` | `1` | ffmpeg thumb workers |
| `PROBE_CONCURRENCY` | `2` | ffprobe workers |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` |

## Volumes

- `/videos` (read-only) — your library
- `/data` — SQLite database + thumbnail cache (persistent)

## Notes on external assets

- The "Pacifico" display font loads from Google Fonts.
- The Squirtle and Mew mascots load from PokeAPI's public sprite repository on GitHub.

If your server has no internet access, both will fall back gracefully (system cursive font and broken-image icon respectively). Drop replacements into `frontend/public/` and update the references in `App.svelte` if you want a fully offline build.

## Troubleshooting

- **No videos appear:** check `docker logs mimis-dance-wonderland` for the walk output. Ensure `VIDEOS_HOST_PATH` is set and points at the right directory.
- **Thumbnails missing:** ffmpeg runs queued at concurrency 1 to keep CPU low. Wait or check `/api/library/status`.
- **Resource use spikes during first run:** thumbnail generation is one-time per video.
