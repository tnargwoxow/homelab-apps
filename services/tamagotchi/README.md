# Tamagotchi

A self-hosted virtual pet for the homelab. FastAPI + SQLite + a vanilla
HTML/JS frontend, served from one container. State lives on a PVC, the pet
keeps progressing whether or not anyone is looking.

## Layout

```
services/tamagotchi/
├── app/             # FastAPI backend
│   ├── main.py      # routes + lifespan
│   ├── game.py      # pure tick logic
│   ├── db.py        # SQLite
│   └── tick.py      # asyncio background loop
├── web/             # static frontend (served by FastAPI)
├── scripts/
│   └── gen_icons.py # regenerate web/icon-*.png (no Pillow needed)
├── Dockerfile
└── pyproject.toml
```

## Local dev

```bash
cd services/tamagotchi
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi 'uvicorn[standard]' pydantic
TAMAGOTCHI_DB=./tamagotchi.db uvicorn app.main:app --reload
# open http://localhost:8000
```

The tick loop runs every 60s. To watch your pet age in fast-forward, you can
edit `TICK_INTERVAL_S` in `app/tick.py` (do NOT commit that change).

## Build & push

```bash
docker build -t tnargwoxow/tamagotchi:latest .
docker push tnargwoxow/tamagotchi:latest
```

Then roll the deployment to pick up the new image (since the manifest tag
hasn't changed, ArgoCD won't roll it for you):

```bash
kubectl -n tamagotchi rollout restart deploy/tamagotchi
```

## Run locally on the Mac (current setup)

```bash
docker run -d --name tamagotchi --restart unless-stopped \
  -p 8000:8000 \
  -e TAMAGOTCHI_DEV=1 \
  -e TZ=Europe/Berlin \
  -v ~/tamagotchi-data:/data \
  tnargwoxow/tamagotchi:latest
```

`TZ` is critical — sleep windows are bound to wall-clock local time, so the
container needs the right timezone or your pet will sleep at the wrong hours.

## Deploy

K8s manifests live under `bases/tamagotchi/` and `overlays/tamagotchi/`.
The ArgoCD `Application` is at `apps/tamagotchi.yaml` and is auto-discovered
by the app-of-apps. After merging to `main`, ArgoCD applies the resources.

App URL on the homelab: `https://tamagotchi.192.168.0.77.sslip.io`
(self-signed cert — accept once per device).

## API

- `GET  /api/pet` — current state
- `POST /api/feed` — `{ "kind": "meal" | "snack" }`
- `POST /api/play` — `{ "won": bool }`
- `POST /api/clean` / `/api/heal` / `/api/discipline` / `/api/lights`
- `POST /api/reset` — `{ "name": string }` hatches a fresh egg
- `GET  /api/events?limit=50` — recent events (used later for graphs)
- `GET  /healthz`
