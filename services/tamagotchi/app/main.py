"""FastAPI entrypoint."""

from __future__ import annotations

import asyncio
import logging
import os
import random
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import db, game, tick

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
log = logging.getLogger("tamagotchi")

DB_PATH = os.environ.get("TAMAGOTCHI_DB", "/data/tamagotchi.db")
WEB_DIR = Path(__file__).resolve().parent.parent / "web"

_rng = random.Random()
_stop: asyncio.Event | None = None
_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _stop, _task
    db.init(DB_PATH)
    _stop = asyncio.Event()
    _task = asyncio.create_task(tick.run_tick_loop(_stop))
    try:
        yield
    finally:
        _stop.set()
        if _task is not None:
            await _task
        db.close()


app = FastAPI(title="Tamagotchi", lifespan=lifespan)


class FeedBody(BaseModel):
    kind: str = "meal"


class PlayBody(BaseModel):
    won: bool = True


class ResetBody(BaseModel):
    name: str = "Tama"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _settle(pet: game.Pet) -> game.Pet:
    """Bring the pet to the present moment before mutating it via an action."""
    now = _now_ms()
    elapsed_ms = max(0, now - pet.last_tick)
    ticks = elapsed_ms // tick.TICK_MS
    if ticks > 0:
        game.apply_ticks(pet, int(ticks), _rng)
        pet.last_tick += int(ticks) * tick.TICK_MS
    return pet


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


@app.get("/api/pet")
def get_pet() -> dict:
    pet = db.get_or_create_pet(_now_ms())
    pet = _settle(pet)
    db.save_pet(pet)
    return pet.to_dict()


@app.post("/api/feed")
def post_feed(body: FeedBody) -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.feed(pet, body.kind)
    db.save_pet(pet)
    db.log_event(pet.id, "feed", {"kind": body.kind, "msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/play")
def post_play(body: PlayBody) -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.play(pet, body.won)
    db.save_pet(pet)
    db.log_event(pet.id, "play", {"won": body.won, "msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/clean")
def post_clean() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.clean(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "clean", {"msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/heal")
def post_heal() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.heal(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "heal", {"msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/discipline")
def post_discipline() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.discipline(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "discipline", {"msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/lights")
def post_lights() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.lights(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "lights", {"msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/reset")
def post_reset(body: ResetBody) -> dict:
    pet = db.reset_pet(_now_ms(), name=body.name)
    return {"pet": pet.to_dict(), "msg": f"hatched {pet.name}"}


@app.get("/api/events")
def get_events(limit: int = 50) -> dict:
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be 1..500")
    pet = db.get_or_create_pet(_now_ms())
    return {"events": db.list_events(pet.id, limit)}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(WEB_DIR)), name="web")
