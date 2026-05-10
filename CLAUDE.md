# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`tnargwoxow/homelab-apps` is a personal homelab monorepo. The top-level layout is **Kubernetes / ArgoCD / Kustomize** (`apps/`, `bases/`, `overlays/`, `argocd/`, `archivedapps/`, `APPLICATION_TEMPLATE.yaml`) — ArgoCD `Application` manifests sync Kustomize bases per service into a cluster. **The user said this part is "out of date" and explicitly asked for Docker / docker-compose deployments instead** — so don't add new K8s manifests for new apps unless asked.

The active feature lives in **`apps/dance-classes/`** — a self-hosted dance-class video streaming app deployed via Docker Compose into a Proxmox LXC. Everything below is about that app.

Primary feature branch: **`claude/dance-class-streaming-app-urVJK`** — develop, commit, and push there. The user pulls from this branch on their Proxmox LXC.

## Dance-classes app

### Stack at a glance

- **Backend**: Node 20 + Fastify + better-sqlite3 + chromecast-api (TS, ESM). Streams MP4 via HTTP byte-range, no transcoding. ffmpeg is only used to generate one thumbnail per video on a queue.
- **Frontend**: Svelte 5 SPA + Vite + Tailwind v4 + svelte-spa-router (hash routing) + vite-plugin-pwa.
- **Android**: Android TV app at `apps/dance-classes/android/` (Kotlin / Gradle, Leanback). Not actively maintained in this conversation flow.
- **Deploy**: Single multi-stage Dockerfile, `docker-compose.yml` uses **`network_mode: host`** (no `ports:`) so the backend can reach Chromecasts via mDNS on the LAN.

### Common commands

All from inside `apps/dance-classes/`:

```bash
# Backend
cd backend
npm install                 # first time
npm run build               # tsc to dist/
npm test                    # node --test, runs *.test.ts via tsx
npm run dev                 # tsx watch src/server.ts (dev server)
npm run scan                # CLI one-shot library walk (without booting the server)

# Frontend
cd frontend
npm install
npm run build               # vite build → dist/, also generates sw.js + manifest
npm run dev                 # vite dev server, proxies /api → :8080
node scripts/gen-icons.mjs  # one-shot regen of the PWA icons via headless Chromium

# Whole app, in Docker
docker compose up -d --build
docker compose logs -f
```

There's no top-level `package.json`; backend and frontend are independent npm projects.

### Smoke-test pattern used in this session

When verifying changes, the canonical loop is:

```bash
rm -rf /tmp/dance-fixture /tmp/dance-data
mkdir -p /tmp/dance-fixture/Test /tmp/dance-data /tmp/empty-public
touch -- /tmp/dance-fixture/Test/-1-\ a.mp4
cd apps/dance-classes/backend && \
  VIDEOS_DIR=/tmp/dance-fixture DATA_DIR=/tmp/dance-data PORT=8088 \
  PUBLIC_DIR=/tmp/empty-public LOG_LEVEL=warn node dist/server.js > /tmp/dance-server.log 2>&1 &
sleep 3
curl -s http://localhost:8088/healthz
# … hit endpoints …
pkill -f "node dist/server.js"
rm -rf /tmp/dance-fixture /tmp/dance-data /tmp/dance-server.log /tmp/empty-public
```

`PUBLIC_DIR` must point at an existing directory (not `/dev/null`) — `@fastify/static` rejects non-directory paths.

### Screenshots

Many user reviews come via screenshots committed at `apps/dance-classes/screenshots/`. The repeating workflow is: spin up the backend pointed at a fixture, seed thumbnails + progress via Playwright + the bundled headless Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, then drive the running app at `localhost:8088` to capture mobile (390×844) and desktop (1440×900) PNGs. Theme selection during shoots requires a hard `page.reload()` after writing `localStorage` because the inline `data-theme` boot script only runs at full load.

### Backend architecture

`backend/src/server.ts` is the entrypoint. Fastify with the SPA fallback serving `dist/` from `${PUBLIC_DIR}` (anything not `/api/*`, `/healthz`, `/sw.js`, etc. falls through to `index.html`).

**Library scanning** is three phases driven by an in-process queue (`src/scanner/`):

1. `walker.ts` — recursive `readdir`, upserts `folders` and `videos` rows with `scan_status='pending'`. FTS5 search rows are inserted alongside.
2. ffprobe queue — fills `duration_sec`, marks `scan_status='probed'`.
3. Thumbnail queue — `ffmpeg` one-frame to `${DATA_DIR}/thumbs/{id}.jpg`, marks `scan_status='ready'`.

A `chokidar` watcher catches add / unlink events on `${VIDEOS_DIR}` and feeds back into phase 1. State lives in `videos.scan_status` so restarts are safe. Concurrency knobs are `THUMB_CONCURRENCY` / `PROBE_CONCURRENCY`.

**Routes** live in `src/routes/*` and are registered in `server.ts`. `library.ts` returns folder payloads (with breadcrumbs and a `thumbVideoIds[]` mosaic sample). `videos.ts` owns metadata + `/stream` (HTTP `Range`-aware, path-traversal guarded, resolves video id → on-disk path via DB). `progress.ts`, `favorites.ts`, `recent.ts`, `search.ts` are mostly thin SQL wrappers. `stats.ts` aggregates from `progress` (no event log table — stats are derived from `progress.updated_at` / `position_seconds` / `duration_seconds`, with a 30-second floor to filter "I just clicked").

**Cast** (`src/cast/`) wraps `chromecast-api` 0.4.2 with two runtime patches that are both load-bearing:

- A **monkey-patch on `castv2.Client.prototype.close`** to make it null-safe — without it, error paths throw "Cannot read properties of null (reading 'destroy')" and bury the real cause.
- An **mDNS `.local` → IPv4 resolver** using `multicast-dns` (a transitive dep). Alpine's musl libc has no nss-mdns, so `tls.connect('xyz.local', 8009)` fails with `ENOTFOUND` otherwise. Hostnames are resolved at discovery time and `device.host` is overwritten with the IP before any connection attempt.

The cast service maintains its own session map keyed by device IP, polls status every 5 s (or 1 s when an A-B loop is set via `setCastLoop`), and hooks the device's `'finished'` event to mark the video as watched in the DB. Stream URLs handed to the Chromecast are built from `req.headers.host` (whatever the phone connected to is, by definition reachable from the same LAN), with `PUBLIC_BASE_URL` as override.

**Database**: SQLite via better-sqlite3, WAL mode, single file at `${DATA_DIR}/library.db`. Schema in `src/db/migrations/*.sql`, runner in `src/db/index.ts` walks migrations in version order on every boot. The Dockerfile **explicitly copies `src/db/migrations` into `dist/db/migrations`** because tsc doesn't pick up SQL files; the runner has a fallback to `src/` for local dev too. Add new migrations as `00N_<name>.sql` and the runner picks them up automatically.

### Frontend architecture

`App.svelte` is the shell: theme-aware header, `<WeeklyGoals />` banner under it, `<Router>` middle, mobile `<BottomNav>` fixed bottom (sm-and-below only; desktop uses header nav). `<CastNowPlaying>` and `<PipNowPlaying>` are floating bars mounted globally that render only when active.

**Routing** is hash-based via `svelte-spa-router`. `router.ts` maps paths to route components. `<a use:link href="/foo">` produces hash links and the action installs an unconditional `event.preventDefault()` + `pushState` click listener on the anchor — **important**: any descendant click inside `<a use:link>` will navigate, even if the inner handler calls `stopPropagation`. The fix used in `VideoCard.svelte` is to make the secondary button (X reset) a *sibling* of the anchor, not a child.

**State** is a handful of Svelte stores in `src/lib/`:

- `stores.ts` — theme + library status polling
- `cast.ts` — devices list, active cast, polling, A-B loop helper
- `pip.ts` — `currentLocalVideo` (the live `<video>` ref), `pipTrack` (last shown PiP), `pipActive`. The auto-PiP-on-navigate trick sets up a capture-phase document `click` listener that runs *before* svelte-spa-router's anchor handler — `requestPictureInPicture()` fires synchronously inside that click so the user's tap counts as the activation gesture, then the navigation continues and the browser keeps PiP alive across the unmount.
- `mediaSession.ts` — `applyMediaSession({ title, artist, album, artworkUrl, position, duration, playbackRate, playing, handlers })` plus `clearMediaSession()`. Watch.svelte calls it whenever meta or play/cast state changes; OS lock-screen / Bluetooth / smartwatch controls work from there.

**Themes**: `lib/themes.ts` defines three configs (`ballet` / `heels` / `hiphop`). `app.css` declares one set of CSS custom properties (`--theme-accent`, `--theme-card-bg`, `--theme-display-font`, etc.) with overrides via `[data-theme="..."]`. `index.html` has an inline boot script that reads `localStorage('mimi-theme')` and sets `data-theme` on `<html>` before paint to avoid a theme flash. Components mostly use inline `style="background: var(--theme-card-bg); ..."` rather than Tailwind classes for theme-affected colors.

### Critical gotchas

- **Empty-body POST/DELETE through `lib/api.ts`'s `send()` MUST NOT set `Content-Type: application/json`.** Fastify rejects it with `FST_ERR_CTP_EMPTY_JSON_BODY`. The helper now only adds the header when `body !== undefined`. The same applies to `lib/cast.ts`'s `post()`. Both helpers also surface the response body's `error` field on non-OK responses — preserve that when refactoring.
- **Mobile horizontal overflow** on phones is recurring. Root cause is always the same: a flex/grid child with implicit `min-width: auto` that can't shrink below its content. Add `min-w-0` (and `overflow-wrap: anywhere` for text) on the offending element. Body has `overflow-x: hidden; touch-action: pan-y` as a backstop, but the proper fix is at the offending node.
- **Cast play won't work without `network_mode: host`** in compose. Multicast DNS doesn't traverse the default Docker bridge. With host networking the container shares the LXC's IP and listens directly on `$PORT` — there is no `ports:` block to add.
- **The repo is private.** The Proxmox installer reads `GITHUB_TOKEN` and writes it to `/root/.git-credentials` inside the LXC for `git clone` + future `git pull`. Don't add code that assumes public access.
- **`@fastify/static` rejects non-directory `root`** at startup, so `PUBLIC_DIR=/dev/null` won't work — use a real empty dir for backend-only smoke tests.
- **Watched flag** is now only set by: the `'ended'` event on `<video>`, the explicit `POST /api/videos/:id/watched`, or a cast `'finished'` event. The progress endpoint **does not** auto-flip it at >=90% any more — the user explicitly chose this. `/api/recent` filters watched=0 so finished videos drop out automatically.
- **Streak rule** lives in `WEEKLY_VIDEOS_TARGET` and `WEEKLY_MINUTES_TARGET` constants in `backend/src/routes/stats.ts`. Both must be met for a Mon→Sun week to qualify (current rule: 1 class + 10 minutes). The `/api/stats` payload's `weekGoals.{videos,minutes}.met` flags drive the `<WeeklyGoals>` banner.

### Deployment

`apps/dance-classes/scripts/install-proxmox.sh` is the canonical deployer. Runs on the PVE host as root, picks a free VMID, downloads the Ubuntu 24.04 LXC template, creates an unprivileged LXC with `nesting=1,keyctl=1`, bind-mounts the host video path at `/videos:ro` via `mp0`, then `pct exec`s into the container to install Docker CE, clone the repo, and `docker compose up -d --build`. The user runs it via:

```bash
GITHUB_TOKEN="$TOKEN" VIDEOS_HOST_PATH=/path \
bash <(curl -fsSL -H "Authorization: token $TOKEN" \
  https://raw.githubusercontent.com/tnargwoxow/homelab-apps/claude/dance-class-streaming-app-urVJK/apps/dance-classes/scripts/install-proxmox.sh)
```

After install, day-to-day updates from the user are: `pct enter <vmid>; cd /opt/homelab-apps/apps/dance-classes; git pull; docker compose up -d --build`.

## When making changes

- Commit and push to `claude/dance-class-streaming-app-urVJK` from the repo root (`/home/user/homelab-apps`). The git working dir traps if you `cd` into a subdir and run `git add` with relative paths from there.
- Don't open a PR unless explicitly asked.
- The user mostly tests on Android (Samsung Internet / Chrome) — when adding UI, always sanity-check the mobile path before reporting done.
- Rebuilds in this conversation are paranoid: `cd backend && npm run build && cd ../frontend && npm run build`. Frontend build also produces `dist/sw.js`, `dist/workbox-*.js`, `dist/manifest.webmanifest` via `vite-plugin-pwa`.
