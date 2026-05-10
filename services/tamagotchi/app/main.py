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
DEV_MODE = os.environ.get("TAMAGOTCHI_DEV", "").lower() in ("1", "true", "yes")

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
    guesses: list[str] = []


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
    pet, result, msg = game.play_round(pet, body.guesses, _rng)
    db.save_pet(pet)
    db.log_event(pet.id, "play", {"guesses": body.guesses, **result, "msg": msg})
    return {"pet": pet.to_dict(), "msg": msg, "result": result}


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


class AdvanceBody(BaseModel):
    minutes: int = 60


class SetStateBody(BaseModel):
    age_minutes: int | None = None
    age_years: int | None = None
    generation: int | None = None
    life_stage: str | None = None
    hunger: float | None = None
    happiness: float | None = None
    discipline: float | None = None
    weight: float | None = None
    poop_count: int | None = None
    poop_oldest_min: int | None = None
    is_sleeping: bool | None = None
    sleep_start_min: int | None = None
    is_sick: bool | None = None
    sick_doses_needed: int | None = None
    alive: bool | None = None
    care_mistakes: int | None = None
    stage_care_mistakes: int | None = None
    lights_off: bool | None = None
    lights_late_warned: bool | None = None
    wants_attention: bool | None = None
    attention_real: bool | None = None
    name: str | None = None


@app.get("/api/dev/status")
def dev_status() -> dict:
    return {"enabled": DEV_MODE}


@app.post("/api/dev/advance")
def dev_advance(body: AdvanceBody) -> dict:
    """Fast-forward the pet's clock by N in-game minutes. Dev-mode only."""
    if not DEV_MODE:
        raise HTTPException(status_code=403, detail="dev mode disabled")
    if body.minutes < 1 or body.minutes > 60 * 24 * 30:
        raise HTTPException(status_code=400, detail="minutes must be 1..43200")
    pet = db.get_or_create_pet(_now_ms())
    pet = _settle(pet)
    game.apply_ticks(pet, body.minutes, _rng)
    pet.last_tick += body.minutes * tick.TICK_MS
    db.save_pet(pet)
    db.log_event(pet.id, "dev_advance", {"minutes": body.minutes})
    return {"pet": pet.to_dict(), "msg": f"advanced {body.minutes} minutes"}


@app.post("/api/dev/setstate")
def dev_setstate(body: SetStateBody) -> dict:
    """Patch arbitrary fields on the pet for testing. Dev-mode only."""
    if not DEV_MODE:
        raise HTTPException(status_code=403, detail="dev mode disabled")
    pet = db.get_or_create_pet(_now_ms())
    patch = body.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(pet, k, v)
    db.save_pet(pet)
    db.log_event(pet.id, "dev_setstate", patch)
    return {"pet": pet.to_dict(), "msg": f"patched {list(patch)}"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(WEB_DIR)), name="web")
