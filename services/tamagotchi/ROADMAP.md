# Tamagotchi Roadmap

A living document of features. Items toward the top are higher
priority — chosen for impact-per-effort, not difficulty.

## Recently shipped

- **Hearts UI** for hunger and happy (4 hearts each, canonical).
- **Discipline pips** — 4-segment bar, rises 25% per successful scold.
- **Real play mini-game** — 5 rounds of left/right, win 3+ for a happy
  heart. Pet faces the way it picked, win/loss markers on the round
  track.
- **Lights-out visual mode** — when pet is sleeping AND lights are off,
  the screen transitions to dark green with moon and twinkling stars.
- **Lights-late care mistake** — fail to turn lights off within 5 min of
  bedtime and it counts against you (same as the original P1).
- **State-driven animations** — egg wobble, sleeping breath (rotated 90°),
  sick wobble, dead opacity, eat-pulse, celebrate-bounce on play win,
  shake on loss / scold, floaty action emoji (🍚 🍬 ✨ 💊).
- **Status detail panel** — exact age in years and sim minutes, weight
  in oz, hunger/happy floats, discipline %, mistakes (total + this
  stage), wants-attention reason, born timestamp.
- **Multi-dose sickness** — illness may need 1-3 medicines to clear.
- **Silent sickness** — pet does not call when sick (canonical), but
  the visible ❰+❱ cross indicator surfaces the state.
- **Generation counter** — reset increments generation; HUD shows
  `Tama · gen 2`.
- **Slower decay** — hunger drains 4→0 in 2h, happy in 3h. Pet doesn't
  feel like a toddler that's always starving.
- **Better discipline semantics** — scolding nothing is a small care
  mistake; scolding a real-need call is a bigger one; scolding a false
  alarm raises discipline +25% and is the only "clean" way.
- **Dev setstate endpoint** for arbitrary state injection during testing.

## Tier 1 — high value, mostly additive

### Pet history graphs
- **Effort:** S
- **Why:** the `pet_event` table already records every action, every dev
  advance, and every `hatched` event. We just don't surface it.
- **Plan:** new route `GET /history` serving a small static page.
  Frontend fetches `/api/events?limit=200`, plots hunger / happiness /
  weight against `ts` using inline SVG (no chart library). Tap an event
  to see its full payload.

### Multiple character evolutions per stage
- **Effort:** M
- **Why:** the original P1 had two child forms, two teen forms, and
  six adult forms based on care quality. We compute `care_mistakes`
  and `stage_care_mistakes` already; they should branch the sprite.
- **Plan:** at each stage transition, pick the resolved character
  based on stage_care_mistakes. Persist as a `character` column.
  - Baby → Child: Marutchi (always)
  - Child → Teen: Tamatchi (≤2 mistakes) | Kuchitamatchi (>2)
  - Teen → Adult: 3-6 forms depending on mistakes + discipline.
  Add new SVG sprites for the variants.

### Web Push notifications when pet calls for attention
- **Effort:** M
- **Why:** the whole point of a server-side pet is it keeps progressing
  while you're not looking. Without push, the user has to remember to
  check in. Closer to the original beep.
- **Plan:**
  1. Generate VAPID keys, store the private key in env.
  2. `POST /api/push/subscribe` accepts a Web Push subscription JSON.
  3. Tick loop: when `wants_attention` flips false→true, deliver a push.
  4. Frontend asks for permission, registers a service worker, posts the
     subscription.
  5. Push requires HTTPS — re-introduces the SW we deferred. Either run
     behind a real cert (mkcert / Tailscale Funnel / Cloudflare Tunnel)
     or accept that LAN pushes need cert trust on each device.

### Care report on death
- **Effort:** S
- **Why:** turn the loss into a closing scene rather than just a
  tombstone. Reinforces what care matters.
- **Plan:** when pet dies, write a `death_report` event with
  lifetime, total feeds, total plays, total scolds, total mistakes
  per stage. Modal on next page load before the reset prompt.

### Pixel-art polish
- **Effort:** S-M
- **Why:** baby and child sprites are too similar. Dead RIP letters are
  tiny. Adult could lose the antennae and have a clearer body.
- **Plan:** redesign each stage's SVG with more silhouette differentiation.
  Add one extra "frame" per stage so we can interpolate (sprite A →
  sprite B mid-bob).

## Tier 2 — meaningful but more work

### Multiple pets (multi-pet)
- **Effort:** M
- **Why:** the schema already has `pet_id`. Mainly UI work: pet picker,
  switch active pet. Lets the family share the device with separate
  pets without resetting.

### Save export / import
- **Effort:** S
- **Why:** insurance against accidental reset, lets you roll back, lets
  you transfer between Macs.
- **Plan:** `GET /api/export` returns JSON of pet + recent events.
  `POST /api/import` accepts the same. "Save" button downloads
  `pet-YYYY-MM-DD.json`.

### Achievements
- **Effort:** M
- **Why:** small persistent meta-game. "First feed", "lived to senior",
  "perfect care (0 mistakes through teen)", "five generations".
- **Plan:** new `achievement` table. Tick loop and action handlers emit
  check events. Tiny badges below the keypad. Persist across pets.

### Home Assistant webhook integration
- **Effort:** S
- **Why:** you already run HA. Pet calling for attention could flash a
  light, low happiness could pulse an LED strip, death could send a
  notification.
- **Plan:** env-var-configurable webhook URL. Tick loop POSTs JSON on
  threshold transitions (`wants_attention` true, `is_sick` true, death).

### Sound effects (Web Audio API)
- **Effort:** S
- **Why:** the *real* Tamagotchi feeling came from the beeps.
- **Plan:** short `OscillatorNode` beeps. Toggle setting in localStorage,
  default off. Beep on attention call, action click, death.

## Tier 3 — nice to have

### Egg-hatch tap mini-game
- **Effort:** S
- **Why:** the egg state is just a few minutes of waiting. Tapping to
  hatch would feel meaningful.
- **Plan:** during egg stage, tapping the pet area cracks the shell
  more in 3 stages, faster reveal at full taps.

### Care quality "stars" rating in HUD
- **Effort:** S
- **Why:** care_mistakes is an integer; stars give a friendly read.
- **Plan:** mapping function in the frontend, render `★★★☆☆` near age.

### Keyboard shortcuts on desktop
- **Effort:** S
- **Why:** if you're on a laptop, mouse-clicking buttons is awkward.
- **Plan:** number keys 1–8 trigger keypad in order. Show shortcut as
  small text on each button when viewport > 600px.

### Image-export pet portrait
- **Effort:** S
- **Why:** capture a moment in time for sharing.
- **Plan:** render the current SVG to a `<canvas>`, download as PNG.

### Multi-user accounts
- **Effort:** L
- **Why:** household members each have their own pet on the same instance.
- **Plan:** auth via OIDC. Defer until multi-pet exists.

## Infrastructure / ops

### Move the image to a registry
- **Effort:** S
- **Why:** currently the image only lives on your Mac. Pushing to
  Docker Hub (or ghcr.io) unblocks running it on the homelab cluster
  (`apps/tamagotchi.yaml` is already written and waiting, commented out).
- **Plan:** `docker login`, `docker push tnargwoxow/tamagotchi:latest`,
  uncomment `apps/tamagotchi.yaml`. Future: tag with the git sha so
  ArgoCD rolls automatically.

### Local dev compose file
- **Effort:** S
- **Why:** `docker run -d --name ... -e ... -v ... -p ...` is verbose.

### Daily backup of `~/tamagotchi-data`
- **Effort:** S
- **Why:** the SQLite file is 100% of the pet's existence.
- **Plan:** launchd job that copies the .db file to a versioned location
  daily, OR call `GET /api/export` and store JSON snapshots.

### Static analysis + tests in CI
- **Effort:** M
- **Why:** game.py is the heart of the simulation. A handful of pytest
  cases on `apply_ticks` would catch regressions when tuning balance.
- **Plan:** pytest, fixtures with seeded Random, tests for hunger/happy
  decay, sleep transitions, lights-late mistake, play-round adjudication,
  stage transitions, death conditions. GitHub Action on PR.
