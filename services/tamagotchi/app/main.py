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

from app import clock, db, game, tick

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


class PlayRoundBody(BaseModel):
    guess: str = "left"


class PlayFinishBody(BaseModel):
    wins: int = 0


class ResetBody(BaseModel):
    name: str = "Tama"


def _now_ms() -> int:
    return clock.now_ms()


def _hour_fn_from(start_ms: int):
    """Return a function f(i) → local wall hour after the i-th tick,
    starting from the given anchor timestamp."""
    return lambda i: clock.local_hour_at(start_ms + (i + 1) * tick.TICK_MS)


def _settle(pet: game.Pet) -> game.Pet:
    """Bring the pet to the present moment before mutating it via an action."""
    now = _now_ms()
    elapsed_ms = max(0, now - pet.last_tick)
    ticks = elapsed_ms // tick.TICK_MS
    if ticks > 0:
        game.apply_ticks(pet, int(ticks), _rng, hour_fn=_hour_fn_from(pet.last_tick))
        pet.last_tick += int(ticks) * tick.TICK_MS
    return pet


# === Achievements ===

ACHIEVEMENTS = [
    # id,           label,                     description
    ("first_feed",   "First bite",              "Feed your pet for the first time"),
    ("first_play",   "First win",               "Win your first play game"),
    ("first_clean",  "Tidy",                    "Clean up after your pet"),
    ("first_heal",   "Doctor",                  "Heal a sick pet"),
    ("first_scold",  "Strict",                  "Successfully scold a misbehaving pet"),
    ("reach_child",  "Toddler",                 "Pet grows into a child"),
    ("reach_teen",   "Teenage years",           "Pet grows into a teen"),
    ("reach_adult",  "Adulthood",               "Pet grows into an adult"),
    ("reach_senior", "Long life",               "Pet reaches its senior years"),
    ("gen_3",        "Generations",             "Raise three generations"),
    ("perfect_baby", "Spotless start",          "0 mistakes through the baby stage"),
    ("perfect_teen", "Model child",             "0 mistakes through the teen stage"),
]
ACHIEVEMENT_INDEX = {a[0]: a for a in ACHIEVEMENTS}


def _check_achievements(pet: game.Pet, action: str | None = None, action_payload: dict | None = None) -> list[str]:
    """Examine pet state + the just-completed action and grant any new
    achievements. Returns a list of newly-granted IDs (frontend pops a
    toast for each). Idempotent — db.grant_achievement is dedup'd."""
    granted: list[str] = []
    payload = action_payload or {}

    def grant(aid: str) -> None:
        if db.grant_achievement(aid, pet.id, pet.generation):
            granted.append(aid)

    if action == "feed":
        grant("first_feed")
    if action == "play_finish" and payload.get("wins", 0) >= 3:
        grant("first_play")
    if action == "clean":
        grant("first_clean")
    if action == "heal":
        grant("first_heal")
    if action == "discipline" and payload.get("kind") == "scold_false_alarm":
        grant("first_scold")

    if pet.life_stage == "child":
        grant("reach_child")
    elif pet.life_stage == "teen":
        grant("reach_teen")
        if pet.character == "tamatchi":
            grant("perfect_baby")
    elif pet.life_stage == "adult":
        grant("reach_adult")
        if pet.character == "mametchi":
            grant("perfect_teen")
    elif pet.life_stage == "senior":
        grant("reach_senior")

    if pet.generation >= 3:
        grant("gen_3")

    return granted


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
    achievements = _check_achievements(pet, "feed", {"kind": body.kind})
    return {"pet": pet.to_dict(), "msg": msg, "achievements": achievements}


@app.post("/api/play/round")
def post_play_round(body: PlayRoundBody) -> dict:
    """Adjudicate ONE round. Stateless. Doesn't mutate the pet."""
    if body.guess not in ("left", "right"):
        raise HTTPException(status_code=400, detail="guess must be left or right")
    pet = db.get_or_create_pet(_now_ms())
    ok, msg = game.play_can_start(pet)
    if not ok:
        raise HTTPException(status_code=409, detail=msg)
    direction = _rng.choice(["left", "right"])
    won = direction == body.guess
    return {"direction": direction, "won": won}


@app.post("/api/play/finish")
def post_play_finish(body: PlayFinishBody) -> dict:
    """Apply the outcome of a 5-round game. Body: {wins: int 0..5}."""
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.play_finish(pet, body.wins)
    db.save_pet(pet)
    db.log_event(pet.id, "play_finish", {"wins": body.wins, "msg": msg})
    achievements = _check_achievements(pet, "play_finish", {"wins": body.wins})
    return {"pet": pet.to_dict(), "msg": msg, "achievements": achievements}


@app.post("/api/clean")
def post_clean() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.clean(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "clean", {"msg": msg})
    achievements = _check_achievements(pet, "clean")
    return {"pet": pet.to_dict(), "msg": msg, "achievements": achievements}


@app.post("/api/heal")
def post_heal() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.heal(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "heal", {"msg": msg})
    achievements = _check_achievements(pet, "heal")
    return {"pet": pet.to_dict(), "msg": msg, "achievements": achievements}


@app.post("/api/discipline")
def post_discipline() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.discipline(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "discipline", {"msg": msg})
    kind = "scold_false_alarm" if "false alarm" in msg else "scold_other"
    achievements = _check_achievements(pet, "discipline", {"kind": kind})
    return {"pet": pet.to_dict(), "msg": msg, "achievements": achievements}


@app.post("/api/lights")
def post_lights() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, msg = game.lights(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "lights", {"msg": msg})
    return {"pet": pet.to_dict(), "msg": msg}


@app.post("/api/tap-egg")
def post_tap_egg() -> dict:
    pet = _settle(db.get_or_create_pet(_now_ms()))
    pet, result, msg = game.tap_egg(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "tap_egg", {**result, "msg": msg})
    return {"pet": pet.to_dict(), "msg": msg, "result": result}


@app.get("/api/export")
def get_export() -> dict:
    """Dump the pet's full state + recent events as JSON for backup."""
    pet = _settle(db.get_or_create_pet(_now_ms()))
    db.save_pet(pet)
    return {
        "version": 1,
        "exported_at": _now_ms(),
        "pet": pet.to_dict(),
        "events": db.list_events(pet.id, limit=500),
        "achievements": db.list_achievements(),
    }


class ImportBody(BaseModel):
    pet: dict


@app.post("/api/import")
def post_import(body: ImportBody) -> dict:
    """Restore a pet from an export. Replaces the current pet."""
    p = body.pet
    incoming = game.Pet(
        id=1,
        name=p.get("name", "Tama"),
        born_at=int(p.get("born_at", _now_ms())),
        last_tick=int(p.get("last_tick", _now_ms())),
        age_minutes=int(p.get("age_minutes", 0)),
        age_years=int(p.get("age_years", 0)),
        generation=int(p.get("generation", 1)),
        life_stage=p.get("life_stage", "egg"),
        character=p.get("character", "egg"),
        hunger=float(p.get("hunger", 4.0)),
        happiness=float(p.get("happiness", 4.0)),
        discipline=float(p.get("discipline", 0.0)),
        weight=float(p.get("weight", 5.0)),
        poop_count=int(p.get("poop_count", 0)),
        is_sleeping=bool(p.get("is_sleeping", False)),
        is_sick=bool(p.get("is_sick", False)),
        sick_doses_needed=int(p.get("sick_doses_needed", 0)),
        alive=bool(p.get("alive", True)),
        care_mistakes=int(p.get("care_mistakes", 0)),
        stage_care_mistakes=int(p.get("stage_care_mistakes", 0)),
        lights_off=bool(p.get("lights_off", False)),
        wants_attention=bool(p.get("wants_attention", False)),
        attention_real=bool(p.get("attention_real", False)),
    )
    db.reset_pet(_now_ms(), name=incoming.name)  # creates a fresh row
    # Now overwrite with imported state.
    db.save_pet(incoming)
    db.log_event(incoming.id, "imported", {"name": incoming.name})
    return {"pet": incoming.to_dict(), "msg": "imported"}


@app.get("/api/achievements")
def get_achievements() -> dict:
    """All defined achievements, plus which ones have been earned."""
    earned = {a["id"]: a for a in db.list_achievements()}
    items = []
    for aid, label, desc in ACHIEVEMENTS:
        items.append({
            "id": aid,
            "label": label,
            "description": desc,
            "earned": aid in earned,
            "earned_at": earned.get(aid, {}).get("earned_at"),
            "earned_generation": earned.get(aid, {}).get("generation"),
        })
    return {"achievements": items, "total": len(ACHIEVEMENTS), "earned": len(earned)}


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


@app.get("/api/clock")
def get_clock() -> dict:
    """Current wall clock as the server sees it, plus dev offset and the
    sleep schedule for the current pet's character."""
    dt = clock.now_dt()
    pet = db.get_or_create_pet(_now_ms())
    schedule = game.schedule_for(pet.character)
    return {
        "iso": dt.isoformat(),
        "hour": dt.hour,
        "minute": dt.minute,
        "offset_minutes": clock.offset_minutes(),
        "is_sleep_hour": game.is_sleep_hour(dt.hour, schedule),
        "schedule": {"start": schedule[0], "end": schedule[1]},
        "character": pet.character,
    }


@app.post("/api/dev/advance")
def dev_advance(body: AdvanceBody) -> dict:
    """Fast-forward the global clock by N minutes. Dev-mode only.
    Settle then runs the catch-up tick loop using the new clock so all
    real-time-derived state (sleep window, etc.) advances correctly."""
    if not DEV_MODE:
        raise HTTPException(status_code=403, detail="dev mode disabled")
    if body.minutes < 1 or body.minutes > 60 * 24 * 30:
        raise HTTPException(status_code=400, detail="minutes must be 1..43200")
    clock.advance(body.minutes)
    pet = db.get_or_create_pet(_now_ms())
    pet = _settle(pet)
    db.save_pet(pet)
    db.log_event(pet.id, "dev_advance", {"minutes": body.minutes})
    return {"pet": pet.to_dict(), "msg": f"clock advanced {body.minutes} min"}


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
