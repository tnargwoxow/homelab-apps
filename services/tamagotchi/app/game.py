"""Pure tick logic. No I/O, no DB, no clock. Caller passes ticks and rng.

A tick is one in-game minute. The server tick loop fires once per real-world
minute, but on startup we catch up many ticks at once based on elapsed time.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field, asdict
from typing import Literal

LifeStage = Literal["egg", "baby", "child", "teen", "adult", "senior", "dead"]

STAGE_THRESHOLDS = [
    ("egg", 3),
    ("baby", 60),
    ("child", 360),
    ("teen", 1080),
    ("adult", 2880),
    ("senior", 5760),
]

MAX_CATCHUP_TICKS = 60 * 24 * 7


@dataclass
class Pet:
    id: int = 1
    name: str = "Tama"
    born_at: int = 0
    last_tick: int = 0
    age_minutes: int = 0
    life_stage: LifeStage = "egg"
    hunger: float = 0.0
    happiness: float = 100.0
    discipline: float = 50.0
    weight: float = 5.0
    poop_count: int = 0
    is_sleeping: bool = False
    is_sick: bool = False
    alive: bool = True
    care_mistakes: float = 0.0
    lights_off: bool = False
    wants_attention: bool = False
    attention_real: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        d["hunger"] = round(self.hunger, 2)
        d["happiness"] = round(self.happiness, 2)
        d["discipline"] = round(self.discipline, 2)
        d["weight"] = round(self.weight, 2)
        d["care_mistakes"] = round(self.care_mistakes, 2)
        return d


def new_pet(now_ms: int, name: str = "Tama") -> Pet:
    return Pet(born_at=now_ms, last_tick=now_ms, name=name)


def _stage_for(age_minutes: int, care_mistakes: float) -> LifeStage:
    penalty = int(care_mistakes * 6)
    age = age_minutes - penalty
    for stage, threshold in STAGE_THRESHOLDS:
        if age < threshold:
            return stage  # type: ignore[return-value]
    return "senior"


SIM_DAY_OFFSET_MIN = 9 * 60  # pet hatches at simulated 9am, awake


def _is_sleep_hour(age_minutes: int, lights_off: bool) -> bool:
    if lights_off:
        return True
    sim_hour = ((age_minutes + SIM_DAY_OFFSET_MIN) // 60) % 24
    return sim_hour >= 21 or sim_hour < 8


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _has_real_need(pet: Pet) -> bool:
    return pet.hunger > 70 or pet.happiness < 30 or pet.poop_count >= 2 or pet.is_sick


def _maybe_call_for_attention(pet: Pet, rng: random.Random) -> None:
    if pet.wants_attention or pet.is_sleeping or not pet.alive:
        return
    if _has_real_need(pet):
        pet.wants_attention = True
        pet.attention_real = True
    elif rng.random() < 0.005:
        pet.wants_attention = True
        pet.attention_real = False


def _clear_attention_if_satisfied(pet: Pet) -> None:
    if pet.wants_attention and pet.attention_real and not _has_real_need(pet):
        pet.wants_attention = False
        pet.attention_real = False


def apply_ticks(pet: Pet, ticks: int, rng: random.Random) -> Pet:
    """Apply N minute-long ticks to the pet. Mutates and returns."""
    if ticks <= 0 or not pet.alive:
        return pet
    ticks = min(ticks, MAX_CATCHUP_TICKS)

    for _ in range(ticks):
        if not pet.alive:
            break

        pet.age_minutes += 1
        pet.is_sleeping = _is_sleep_hour(pet.age_minutes, pet.lights_off)
        k = 0.3 if pet.is_sleeping else 1.0

        pet.hunger = clamp(pet.hunger + 0.4 * k, 0, 100)
        pet.happiness = clamp(pet.happiness - 0.3 * k, 0, 100)
        pet.weight = clamp(pet.weight - 0.01 * k, 1, 99)

        if not pet.is_sleeping and pet.weight > 5 and rng.random() < 0.03:
            pet.poop_count = min(pet.poop_count + 1, 9)

        if not pet.is_sick:
            sick_p = 0.001 * pet.poop_count + (0.0005 if pet.hunger > 80 else 0.0)
            if rng.random() < sick_p:
                pet.is_sick = True

        if pet.hunger > 90 or pet.happiness < 10 or pet.poop_count > 3 or pet.is_sick:
            pet.care_mistakes += 0.05

        pet.life_stage = _stage_for(pet.age_minutes, pet.care_mistakes)

        if pet.hunger >= 100 and rng.random() < 0.02:
            pet.alive = False
        elif pet.is_sick and rng.random() < 0.005:
            pet.alive = False
        elif pet.life_stage == "senior":
            senior_max = 5760 + 1440 - int(pet.care_mistakes * 60)
            if pet.age_minutes > senior_max and rng.random() < 0.01:
                pet.alive = False

        if not pet.alive:
            pet.life_stage = "dead"
            pet.wants_attention = False
            pet.attention_real = False
            break

        _maybe_call_for_attention(pet, rng)

    return pet


def feed(pet: Pet, kind: str) -> tuple[Pet, str]:
    if not pet.alive:
        return pet, "pet is no longer with us"
    if pet.is_sleeping:
        return pet, "shh, pet is sleeping"
    if kind == "meal":
        if pet.hunger < 20:
            pet.care_mistakes += 0.1
            return pet, "pet refused — not hungry"
        pet.hunger = clamp(pet.hunger - 35, 0, 100)
        pet.weight = clamp(pet.weight + 1.5, 1, 99)
        _clear_attention_if_satisfied(pet)
        return pet, "fed a meal"
    if kind == "snack":
        pet.happiness = clamp(pet.happiness + 12, 0, 100)
        pet.weight = clamp(pet.weight + 0.6, 1, 99)
        if pet.hunger < 30:
            pet.care_mistakes += 0.05
        pet.hunger = clamp(pet.hunger - 8, 0, 100)
        _clear_attention_if_satisfied(pet)
        return pet, "fed a snack"
    return pet, f"unknown food: {kind}"


def play(pet: Pet, guess: str, rng: random.Random) -> tuple[Pet, dict, str]:
    """Mini-game: pet faces left or right; user guesses. Match = win."""
    if not pet.alive:
        return pet, {"started": False}, "pet is no longer with us"
    if pet.is_sleeping:
        return pet, {"started": False}, "shh, pet is sleeping"
    if guess not in ("left", "right"):
        return pet, {"started": False}, "pick left or right"
    direction = rng.choice(["left", "right"])
    won = guess == direction
    pet.weight = clamp(pet.weight - 0.4, 1, 99)
    if won:
        pet.happiness = clamp(pet.happiness + 18, 0, 100)
        msg = f"pet looked {direction} — you guessed right!"
    else:
        pet.happiness = clamp(pet.happiness - 4, 0, 100)
        msg = f"pet looked {direction} — wrong guess"
    _clear_attention_if_satisfied(pet)
    return pet, {"started": True, "won": won, "direction": direction}, msg


def clean(pet: Pet) -> tuple[Pet, str]:
    if pet.poop_count == 0:
        return pet, "nothing to clean"
    pet.poop_count = 0
    _clear_attention_if_satisfied(pet)
    return pet, "cleaned up"


def heal(pet: Pet) -> tuple[Pet, str]:
    if not pet.is_sick:
        pet.care_mistakes += 0.05
        return pet, "pet wasn't sick"
    pet.is_sick = False
    _clear_attention_if_satisfied(pet)
    return pet, "gave medicine"


def discipline(pet: Pet) -> tuple[Pet, str]:
    if not pet.alive:
        return pet, "pet is no longer with us"
    if pet.is_sleeping:
        return pet, "pet is asleep — let it rest"
    if not pet.wants_attention:
        # Scolding when pet wasn't asking for attention is a small care mistake.
        pet.discipline = clamp(pet.discipline - 3, 0, 100)
        pet.happiness = clamp(pet.happiness - 6, 0, 100)
        pet.care_mistakes += 0.05
        return pet, "pet wasn't asking for attention"
    if pet.attention_real:
        # Pet had a real need; scolding is a real care mistake.
        pet.discipline = clamp(pet.discipline - 5, 0, 100)
        pet.happiness = clamp(pet.happiness - 12, 0, 100)
        pet.care_mistakes += 0.2
        pet.wants_attention = False
        pet.attention_real = False
        return pet, "pet had a real need — bad scold"
    # False alarm — scolding teaches discipline.
    pet.discipline = clamp(pet.discipline + 15, 0, 100)
    pet.happiness = clamp(pet.happiness - 3, 0, 100)
    pet.wants_attention = False
    pet.attention_real = False
    return pet, "false alarm — disciplined"


def lights(pet: Pet) -> tuple[Pet, str]:
    pet.lights_off = not pet.lights_off
    return pet, "lights off" if pet.lights_off else "lights on"
