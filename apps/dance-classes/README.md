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

## Deploying on a Proxmox host (one command)

The repo is private, so you'll need a GitHub Personal Access Token with read-only access to it.

### Step 1 — Create a fine-grained PAT

1. Open <https://github.com/settings/personal-access-tokens/new>.
2. **Token name:** `Mimi Dance Proxmox` (or whatever).
3. **Resource owner:** the account that owns this repo (`tnargwoxow`).
4. **Repository access:** *Only select repositories* → pick `homelab-apps`.
5. **Permissions → Repository permissions:** set **Contents** to **Read-only**. Leave everything else as "No access".
6. **Expiration:** whatever you're comfortable rotating (90 days is a sensible default).
7. **Generate token** and copy it (`github_pat_…`). You won't be able to see it again.

### Step 2 — Run the installer

SSH to your PVE node as root, paste your token into a shell variable, and run:

```bash
TOKEN=github_pat_paste_here

GITHUB_TOKEN="$TOKEN" VIDEOS_HOST_PATH=/mnt/data/dance \
bash <(curl -fsSL -H "Authorization: token $TOKEN" \
  https://raw.githubusercontent.com/tnargwoxow/homelab-apps/claude/dance-class-streaming-app-urVJK/apps/dance-classes/scripts/install-proxmox.sh)
```

Replace `/mnt/data/dance` with the absolute path to your dance video library on the PVE host. (It's prompted for if you omit `VIDEOS_HOST_PATH`.)

What happens:

- Picks the next free VMID (starting at 200) and downloads the Ubuntu 24.04 LXC template if needed.
- Creates an unprivileged LXC with `nesting=1,keyctl=1` so Docker works inside.
- Bind-mounts your video path into the container at `/videos` (read-only).
- Boots the container, installs Docker CE + the compose plugin.
- Stores the token in `/root/.git-credentials` (chmod 600) inside the LXC and clones the repo.
- Runs `docker compose up -d --build` and prints the URL when healthcheck passes.

### Optional overrides

```bash
GITHUB_TOKEN="$TOKEN" \
VIDEOS_HOST_PATH=/mnt/data/dance \
VMID=215 HOSTNAME=mimi STORAGE=local-zfs DISK_SIZE=10 MEMORY=1536 CORES=2 \
bash <(curl -fsSL -H "Authorization: token $TOKEN" \
  https://raw.githubusercontent.com/tnargwoxow/homelab-apps/claude/dance-class-streaming-app-urVJK/apps/dance-classes/scripts/install-proxmox.sh)
```

### Managing it after install

From the PVE host:

```bash
pct enter <vmid>                         # shell into the container
pct stop <vmid>; pct start <vmid>        # stop/start the container
```

Inside the container:

```bash
cd /opt/homelab-apps/apps/dance-classes
docker compose logs -f                   # tail logs
docker compose pull && docker compose up -d --build   # update to latest branch
```

### When your token expires

Rotate the token in GitHub, SSH into the LXC (`pct enter <vmid>`), and update `/root/.git-credentials`:

```bash
echo "https://oauth2:NEW_TOKEN@github.com" > /root/.git-credentials
chmod 600 /root/.git-credentials
```

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
