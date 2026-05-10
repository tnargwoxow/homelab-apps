# Tamagotchi Roadmap

A living document of features to add. Items toward the top are higher
priority — chosen for impact-per-effort, not difficulty. Each item lists
**effort** (S/M/L), **why it's worth doing**, and a sketch of the work.

## Tier 1 — high value, mostly additive

### Pet history graphs
- **Effort:** S
- **Why:** the `pet_event` table already records every action, every dev
  advance, and every `hatched` event. We just don't surface it. A simple
  history page would let you see when your pet was last fed, how its
  hunger drifted overnight, and validate that the tick loop is healthy.
- **Plan:** new route `GET /history` serving a small static page. Frontend
  fetches `/api/events?limit=200`, plots hunger / happiness / weight
  against `ts` using inline SVG (no chart library). Tap an event to see
  its full payload. Add a "history" button to the keypad.

### Generation counter
- **Effort:** S
- **Why:** death currently feels like a dead end. A generation counter
  ("gen 3 of Tama") makes the loop feel like a series, not a single
  ephemeral pet.
- **Plan:** schema bump to add `generation INTEGER NOT NULL DEFAULT 1`.
  Reset increments generation. HUD shows `Tama · gen 2`. Optional: a
  graveyard view listing prior generations from `pet_event` where
  `kind='hatched'` and any final state we snapshotted.

### Status detail panel
- **Effort:** S
- **Why:** the bars are good for glanceable info but the original
  Tamagotchi had a status check showing exact age, weight, discipline %.
  Useful for debugging too.
- **Plan:** long-press (or new "info" button) opens a modal showing:
  age in days/hours/minutes, weight in tamagotchi-oz, discipline %,
  generation, born_at as a real timestamp, care_mistakes counter, time
  asleep so far.

### Web Push notifications when pet calls for attention
- **Effort:** M
- **Why:** the whole point of a server-side pet is it keeps progressing
  while you're not looking. Without push, the user has to remember to
  check in. With push, the pet meaningfully nags you — much closer to
  the original beep.
- **Plan:**
  1. Generate a VAPID key pair, store the private key in a K8s secret
     (or env var for the local-Docker setup).
  2. `POST /api/push/subscribe` accepts a Web Push subscription JSON,
     stores it in a new `push_subscription` table.
  3. Tick loop: when `wants_attention` flips from false to true, queue
     a notification ("Tama wants attention!" with a small payload).
  4. Frontend asks for permission once, registers a service worker,
     subscribes, posts the subscription.
  5. Important: this re-introduces the service worker we deferred. On a
     plain-HTTP local-host setup it won't work — push requires HTTPS.
     Either add a self-signed cert via mkcert + ingress on the cluster,
     or run behind Tailscale Funnel / Cloudflare Tunnel.

### Multiple character evolutions per stage
- **Effort:** M
- **Why:** the original had multiple possible outcomes per life stage
  (good adult vs bad adult), determined by care quality. We compute
  `care_mistakes` already but every pet looks the same.
- **Plan:** branch the SVG sprites at child / teen / adult into "good"
  and "bad" variants based on `care_mistakes` thresholds. Maybe two new
  stages too: "quirky" (medium mistakes) for variety. Persist the
  realised character at each transition so it doesn't oscillate.

## Tier 2 — meaningful but more work

### Multiple pets (multi-pet)
- **Effort:** M
- **Why:** the schema already has `pet_id`. Mainly UI work: pet picker,
  switch active pet. Lets the family share the device with separate
  pets without resetting.
- **Plan:** `GET /api/pets`, `POST /api/pets` (hatch new), pet selector
  in the HUD, all action endpoints take `?pet_id=` or use a "current"
  pointer. Server tick advances every alive pet each minute.

### Save export / import
- **Effort:** S
- **Why:** insurance against accidental reset, lets you roll back a bad
  scolding spree, lets you transfer a pet between Macs.
- **Plan:** `GET /api/export` returns a JSON dump of the pet row plus
  recent events. `POST /api/import` accepts the same. Add a tiny "save"
  button that triggers download of `pet-YYYY-MM-DD.json`.

### Care report on death
- **Effort:** S
- **Why:** turn the loss into a closing scene rather than just a
  tombstone sprite. Reinforces what care matters.
- **Plan:** when pet dies, write a `death_report` event with stats
  (lifetime, total feeds, total plays, total scolds, total mistakes,
  longest sleep streak, etc.). Show it as a modal on next page load
  before the reset prompt.

### Achievements
- **Effort:** M
- **Why:** small persistent meta-game. "First feed", "lived to senior",
  "perfect care (0 mistakes through teen)", "five generations".
- **Plan:** new `achievement` table. Tick loop and action handlers emit
  achievement check events. Tiny badges below the keypad. Persists
  across pet generations.

### Home Assistant webhook integration
- **Effort:** S
- **Why:** you already run HA. Pet calling for attention could flash a
  light, low happiness could pulse an LED strip, death could send a
  notification.
- **Plan:** env-var-configurable webhook URL. Tick loop POSTs a small
  JSON payload on threshold transitions (`wants_attention` true,
  `is_sick` true, death). Optionally a generic outbound webhooks table.

### Sound effects (Web Audio API)
- **Effort:** S
- **Why:** the *real* Tamagotchi feeling came from the beeps.
- **Plan:** add a few short beeps via `OscillatorNode`. Toggle setting
  in localStorage (default off — the beep is annoying without choice).
  Beep on attention call, on action click, on death.

## Tier 3 — nice to have

### Eggs hatch via mini-game
- **Effort:** S
- **Why:** the egg state is just a 3-minute wait. A tap-to-hatch
  interaction would feel meaningful.
- **Plan:** during egg stage, tapping the pet area cracks the shell
  more (1/3 → 2/3 → fully hatched). Random number of taps required.

### Nighttime UI
- **Effort:** S
- **Why:** when the pet is sleeping, the screen could go darker / dim
  the buttons / show stars. Makes the day-night cycle feel real.
- **Plan:** add a `.is-night` class to `.screen` when `pet.is_sleeping`.
  CSS dims background to a darker GB green and reveals a few static
  star pixels.

### Care quality "stars" rating in HUD
- **Effort:** S
- **Why:** care_mistakes is a scary float. Stars (1–5) give a friendly
  read.
- **Plan:** mapping function in the frontend, render `★★★☆☆` near the
  age in the HUD.

### Keyboard shortcuts on desktop
- **Effort:** S
- **Why:** if you're at your laptop, mouse-clicking buttons is awkward.
- **Plan:** number keys 1–8 trigger the keypad buttons in order. Show
  the shortcut as small text on each button when viewport > 600px.

### Multi-user accounts
- **Effort:** L
- **Why:** household members each have their own pet on the same
  instance.
- **Plan:** auth via OIDC (you already have ArgoCD, could reuse). User
  table, pet rows tied to user_id. Defer until multi-pet exists, since
  this builds on it.

### Image-export pet portrait
- **Effort:** S
- **Why:** capture a moment in time for sharing.
- **Plan:** render the current SVG to a `<canvas>`, download as PNG.

## Infrastructure / ops

### Move the image to a registry
- **Effort:** S
- **Why:** currently the image only lives on your Mac. If the Mac dies,
  the running app dies with it. Pushing to Docker Hub (or ghcr.io)
  unblocks running it on the homelab cluster (the ArgoCD Application
  is already written and waiting in `apps/tamagotchi.yaml`, just
  commented out).
- **Plan:** `docker login`, `docker push tnargwoxow/tamagotchi:latest`,
  uncomment `apps/tamagotchi.yaml`. Future: tag with the git sha so
  ArgoCD rolls automatically on commit.

### Local dev compose file
- **Effort:** S
- **Why:** `docker run -d --name ... -e ... -v ... -p ...` is verbose.
  A `compose.yaml` documents the canonical run.
- **Plan:** `services/tamagotchi/compose.yaml` mirrors the current
  flags, with TAMAGOTCHI_DEV settable via override.

### Backup of `~/tamagotchi-data`
- **Effort:** S
- **Why:** the SQLite file is 100% of the pet's existence. Lose it,
  lose all generations.
- **Plan:** a tiny launchd or cron job that copies the .db file to a
  versioned location daily. Or: schedule the `GET /api/export` call
  and store JSON snapshots.

### Static analysis + tests in CI
- **Effort:** M
- **Why:** game.py is the heart of the simulation. A handful of pytest
  cases on `apply_ticks` would catch regressions when tuning balance
  numbers.
- **Plan:** `pytest`, fixtures with seeded Random, tests for: hunger
  drift rate, sleep hour calculation, death threshold, care mistake
  accumulation. GitHub Action that runs on PR.
