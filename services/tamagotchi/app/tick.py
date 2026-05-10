"""Background tick loop. Runs once per real-world minute."""

from __future__ import annotations

import asyncio
import logging
import random

from app import clock, db, game

log = logging.getLogger("tamagotchi.tick")

TICK_INTERVAL_S = 60
TICK_MS = 60_000


def _hour_fn_from(start_ms: int):
    return lambda i: clock.local_hour_at(start_ms + (i + 1) * TICK_MS)


async def run_tick_loop(stop: asyncio.Event) -> None:
    rng = random.Random()
    catch_up(rng)
    log.info("tick loop started")
    try:
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=TICK_INTERVAL_S)
                break
            except asyncio.TimeoutError:
                pass
            try:
                tick_once(rng)
            except Exception:
                log.exception("tick failed")
    finally:
        log.info("tick loop stopped")


def catch_up(rng: random.Random) -> None:
    now_ms = clock.now_ms()
    pet = db.get_or_create_pet(now_ms)
    elapsed_ms = max(0, now_ms - pet.last_tick)
    ticks = elapsed_ms // TICK_MS
    if ticks <= 0:
        return
    log.info("catching up %d ticks", ticks)
    game.apply_ticks(pet, int(ticks), rng, hour_fn=_hour_fn_from(pet.last_tick))
    pet.last_tick += int(ticks) * TICK_MS
    db.save_pet(pet)


def tick_once(rng: random.Random) -> None:
    now_ms = clock.now_ms()
    pet = db.get_or_create_pet(now_ms)
    elapsed_ms = max(0, now_ms - pet.last_tick)
    ticks = elapsed_ms // TICK_MS
    if ticks <= 0:
        return
    game.apply_ticks(pet, int(ticks), rng, hour_fn=_hour_fn_from(pet.last_tick))
    pet.last_tick += int(ticks) * TICK_MS
    # Surprise roll once per tick batch.
    pet, surprise = game.maybe_surprise(pet, rng)
    if surprise:
        db.log_event(pet.id, "surprise", surprise)
    db.save_pet(pet)
