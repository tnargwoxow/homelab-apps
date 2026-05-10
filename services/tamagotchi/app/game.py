"""Pure tick logic. No I/O, no DB, no clock. Caller passes ticks and rng.

Designed after the canonical 1996 Tamagotchi P1:
  - Hunger and happiness are 4-heart meters, not continuous bars (we
    store them as floats internally for smooth decay, render as ints).
  - Care mistake = a need (hunger 0, happy 0, or sick) ignored for
    >15 minutes, OR lights left on after bedtime, OR poop sitting too
    long. Each mistake influences future evolution and shortens life.
  - Discipline rises 25% per successful scold. Misbehaviour calls auto-
    expire after 5 minutes (ignoring is fine, scolding when there is no
    misbehaviour is a small care mistake).
  - Play is a 5-round left/right guess; happiness reward scales with
    rounds won, +1 heart at 3+ wins.
  - Sickness is silent (pet does NOT call). It happens once per life
    stage and again if poop sits too long. May require 1-3 medicines.
  - Sleep: 21:00 to 08:00 sim-time. Lights must be turned off within
    5 sim-minutes of bedtime or care mistake. Lights auto-on on wake.

Time scale: 1 real minute = 1 sim minute.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, asdict
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

MAX_HEARTS = 4.0
# Canonical pacing: a few feedings per day, not every two hours.
# Pet awake ~13h/day, so hunger drains about 6 hearts of decay across a
# waking day at this rate — comfortable with 2-3 meals.
HUNGER_MINUTES_TO_EMPTY = 600  # 10 real hours from full to 0 (~2.5h/heart)
HAPPY_MINUTES_TO_EMPTY = 900   # 15 real hours from full to 0 (~3.75h/heart)
HUNGER_DECAY_PER_MIN = MAX_HEARTS / HUNGER_MINUTES_TO_EMPTY
HAPPY_DECAY_PER_MIN  = MAX_HEARTS / HAPPY_MINUTES_TO_EMPTY

NEED_PATIENCE_MIN = 30        # ignored need = care mistake
LIGHTS_GRACE_MIN = 5          # lights must go off within 5 min of bedtime
POOP_PATIENCE_MIN = 90        # uncleaned poop = sickness/mistake risk
MISBEHAVE_TIMEOUT_MIN = 5     # misbehaviour auto-clears
MISBEHAVE_PROB_PER_MIN = 0.001  # ~1 per 1000 minutes
SICKNESS_FROM_POOP_PROB = 0.005  # per minute past POOP_PATIENCE_MIN

# Per-character sleep windows in *real* local hours, derived from the
# canonical 1996 P1 documentation (thaao.net, fandom wiki). Each entry is
# (sleep_start_hour, wake_hour). A start==wake means "never sleeps".
SLEEP_SCHEDULES: dict[str, tuple[int, int]] = {
    "egg":          (12, 12),    # eggs don't sleep
    "babytchi":     (19, 10),    # young pets sleep a lot
    "marutchi":     (20, 9),     # canonical Marutchi schedule
    "tamatchi":     (21, 8),     # good teen
    "kuchitamatchi":(22, 8),     # bad teen
    "mametchi":     (21, 7),     # disciplined adult
    "ginjirotchi":  (22, 8),
    "kuchipatchi":  (22, 9),     # likes a lie-in
    "tarakotchi":   (23, 11),    # sleeps a lot
    "ghost":        (12, 12),    # dead pets don't sleep
}

DEFAULT_SLEEP_SCHEDULE = (21, 8)


def schedule_for(character: str) -> tuple[int, int]:
    return SLEEP_SCHEDULES.get(character, DEFAULT_SLEEP_SCHEDULE)


@dataclass
class Pet:
    id: int = 1
    name: str = "Tama"
    born_at: int = 0
    last_tick: int = 0
    age_minutes: int = 0
    age_years: int = 0          # increments on every wake from sleep
    generation: int = 1
    life_stage: LifeStage = "egg"
    character: str = "babytchi"  # specific form within the life stage

    # Stats — stored as floats, rendered as int hearts (0-4).
    hunger: float = MAX_HEARTS      # 4 = full / not hungry, 0 = starving
    happiness: float = MAX_HEARTS   # 4 = full / happy, 0 = miserable
    discipline: float = 0.0         # 0..100, +25 per successful scold
    weight: float = 5.0

    poop_count: int = 0
    poop_oldest_min: int = -1   # age_minutes when oldest poop appeared, -1 if none

    is_sleeping: bool = False
    sleep_start_min: int = -1   # age_minutes when current sleep began, -1 if not asleep
    lights_off: bool = False
    lights_late_warned: bool = False

    is_sick: bool = False
    sick_doses_needed: int = 0
    next_sickness_min: int = -1  # planned sickness for current stage, -1 if not scheduled

    alive: bool = True
    care_mistakes: int = 0       # integer count
    stage_care_mistakes: int = 0  # mistakes accrued in current stage (resets on transition)
    stage_started_min: int = 0

    # Attention call state.
    wants_attention: bool = False
    attention_real: bool = False
    attention_started_min: int = -1


    def to_dict(self) -> dict:
        d = asdict(self)
        d["hunger_hearts"]    = max(0, min(4, int(self.hunger + 1e-9)))
        d["happiness_hearts"] = max(0, min(4, int(self.happiness + 1e-9)))
        d["discipline"]       = round(self.discipline, 1)
        d["hunger"]           = round(self.hunger, 2)
        d["happiness"]        = round(self.happiness, 2)
        d["weight"]           = round(self.weight, 2)
        return d


def new_pet(now_ms: int, name: str = "Tama", generation: int = 1) -> Pet:
    return Pet(born_at=now_ms, last_tick=now_ms, name=name, generation=generation)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _stage_for(age_minutes: int, care_mistakes: int) -> LifeStage:
    # Each care mistake shortens the perceived age by ~6 sim minutes,
    # accelerating the move toward senior/death.
    age = age_minutes - care_mistakes * 6
    for stage, threshold in STAGE_THRESHOLDS:
        if age < threshold:
            return stage  # type: ignore[return-value]
    return "senior"


def _character_for(stage: LifeStage, prev_character: str, stage_mistakes: int) -> str:
    """Branch evolution. Care quality during the previous stage feeds
    forward into which form the pet takes next."""
    if stage == "egg":
        return "egg"
    if stage == "baby":
        return "babytchi"
    if stage == "child":
        return "marutchi"
    if stage == "teen":
        # Good care during child → tamatchi; otherwise → kuchitamatchi.
        return "tamatchi" if stage_mistakes <= 2 else "kuchitamatchi"
    if stage == "adult":
        # Adult form depends on previous teen form + care during teen.
        if prev_character == "tamatchi":
            return "mametchi" if stage_mistakes <= 1 else "ginjirotchi"
        # bad teen path
        return "kuchipatchi" if stage_mistakes <= 2 else "tarakotchi"
    if stage == "senior":
        return prev_character  # senior keeps adult character (visually aged)
    if stage == "dead":
        return "ghost"
    return prev_character


def is_sleep_hour(hour: int, schedule: tuple[int, int] = DEFAULT_SLEEP_SCHEDULE) -> bool:
    """Whether the given local hour falls inside the sleep window.
    Handles wraparound (start > end) and the never-sleep case (start == end)."""
    start, end = schedule
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end


def _has_real_need(pet: Pet) -> bool:
    return (
        pet.hunger <= 0
        or pet.happiness <= 0
        or pet.poop_count >= 2
        or pet.is_sick
    )


def _maybe_call_for_attention(pet: Pet, rng: random.Random) -> None:
    if not pet.alive or pet.is_sleeping:
        return
    # Real-need calls take priority and persist until satisfied.
    if _has_real_need(pet):
        if not (pet.wants_attention and pet.attention_real):
            pet.wants_attention = True
            pet.attention_real = True
            pet.attention_started_min = pet.age_minutes
        return
    # Misbehaviour: rare, only if discipline isn't full and pet is well.
    if pet.wants_attention:
        return
    if pet.discipline >= 100.0:
        return
    if rng.random() < MISBEHAVE_PROB_PER_MIN:
        pet.wants_attention = True
        pet.attention_real = False
        pet.attention_started_min = pet.age_minutes


def _expire_misbehaviour(pet: Pet) -> None:
    """Misbehaviour calls auto-clear after a timeout (no penalty)."""
    if (
        pet.wants_attention
        and not pet.attention_real
        and pet.attention_started_min >= 0
        and pet.age_minutes - pet.attention_started_min >= MISBEHAVE_TIMEOUT_MIN
    ):
        pet.wants_attention = False
        pet.attention_started_min = -1


def _accrue_need_mistakes(pet: Pet) -> None:
    """If a real-need call has been ignored too long, count a care mistake."""
    if (
        pet.wants_attention
        and pet.attention_real
        and pet.attention_started_min >= 0
        and pet.age_minutes - pet.attention_started_min >= NEED_PATIENCE_MIN
    ):
        pet.care_mistakes += 1
        pet.stage_care_mistakes += 1
        # Reset the call timer so we don't accrue again every tick.
        pet.attention_started_min = pet.age_minutes


def _clear_attention_if_satisfied(pet: Pet) -> None:
    if pet.wants_attention and pet.attention_real and not _has_real_need(pet):
        pet.wants_attention = False
        pet.attention_real = False
        pet.attention_started_min = -1


def _handle_sleep_transitions(pet: Pet, hour: int) -> None:
    """Toggle is_sleeping + lights mistakes + age++ on wake.
    `hour` is the wall-clock local hour to test against. Sleep window
    is per-character. Lights-off doesn't keep the pet asleep — they wake
    up naturally at the end of their schedule (canonical behaviour)."""
    should_sleep = is_sleep_hour(hour, schedule_for(pet.character))

    if should_sleep and not pet.is_sleeping:
        pet.is_sleeping = True
        pet.sleep_start_min = pet.age_minutes
        pet.lights_late_warned = False
        # Sleeping clears outstanding attention calls — pet can't be
        # "ignored" while asleep. Real needs that persist until morning
        # will re-trigger on wake.
        pet.wants_attention = False
        pet.attention_real = False
        pet.attention_started_min = -1
    elif not should_sleep and pet.is_sleeping:
        # Wake up.
        pet.is_sleeping = False
        pet.sleep_start_min = -1
        pet.age_years += 1
        pet.lights_off = False        # canonical: lights auto-turn-on
        pet.lights_late_warned = False

    if (
        pet.is_sleeping
        and not pet.lights_off
        and pet.sleep_start_min >= 0
        and not pet.lights_late_warned
        and pet.age_minutes - pet.sleep_start_min >= LIGHTS_GRACE_MIN
    ):
        pet.care_mistakes += 1
        pet.stage_care_mistakes += 1
        pet.lights_late_warned = True


def _handle_poop_sickness(pet: Pet, rng: random.Random) -> None:
    """Poop that sits gets a chance to make the pet sick, silently."""
    if pet.poop_count == 0:
        pet.poop_oldest_min = -1
        return
    if pet.poop_oldest_min < 0:
        pet.poop_oldest_min = pet.age_minutes
    age_of_poop = pet.age_minutes - pet.poop_oldest_min
    if pet.is_sick or age_of_poop < POOP_PATIENCE_MIN:
        return
    # Rolling chance per overdue minute to trigger sickness.
    if rng.random() < SICKNESS_FROM_POOP_PROB:
        pet.is_sick = True
        pet.sick_doses_needed = rng.randint(1, 3)


def _maybe_schedule_sickness(pet: Pet, rng: random.Random) -> None:
    """Each life stage (post-baby) gets one scheduled sickness episode.
    Skipping baby keeps the early game forgiving."""
    if pet.is_sick or pet.life_stage in ("egg", "baby", "dead"):
        return
    if pet.next_sickness_min == -1:
        # Schedule somewhere in the back half of the current stage.
        stage_idx = next(
            (i for i, (n, _) in enumerate(STAGE_THRESHOLDS) if n == pet.life_stage),
            None,
        )
        if stage_idx is None:
            return
        stage_end = STAGE_THRESHOLDS[stage_idx][1]
        prev_end = STAGE_THRESHOLDS[stage_idx - 1][1] if stage_idx > 0 else 0
        # Schedule within stage; use stage_started_min as anchor not absolute.
        midpoint = (prev_end + stage_end) // 2
        delay = rng.randint(midpoint - prev_end, stage_end - prev_end - 1)
        pet.next_sickness_min = pet.stage_started_min + delay
    elif pet.age_minutes >= pet.next_sickness_min:
        pet.is_sick = True
        pet.sick_doses_needed = rng.randint(1, 2)
        pet.next_sickness_min = -2  # used


def _life_stage_transition(pet: Pet) -> None:
    new_stage = _stage_for(pet.age_minutes, pet.care_mistakes)
    if new_stage != pet.life_stage:
        pet.character = _character_for(new_stage, pet.character, pet.stage_care_mistakes)
        pet.life_stage = new_stage
        pet.stage_started_min = pet.age_minutes
        pet.stage_care_mistakes = 0
        pet.next_sickness_min = -1  # reschedule for new stage


def _maybe_die(pet: Pet, rng: random.Random) -> None:
    if not pet.alive:
        return
    # Death from chronic starvation. Pet must have been at hunger=0 for a
    # while (real-need call must have already been raised >= 60 min ago)
    # before death rolls become possible. Tunable harshness: ~25% chance
    # of dying per hour after that point.
    if pet.hunger <= 0 and pet.attention_real and pet.attention_started_min >= 0:
        if pet.age_minutes - pet.attention_started_min >= 60:
            if rng.random() < 0.005:
                pet.alive = False
    # Death from sustained illness — has to ignore for many hours.
    elif pet.is_sick and rng.random() < 0.0001:
        pet.alive = False
    # Death from old age, accelerated by care mistakes.
    elif pet.life_stage == "senior":
        senior_max = 5760 + 1440 - pet.care_mistakes * 30
        if pet.age_minutes > senior_max and rng.random() < 0.01:
            pet.alive = False

    if not pet.alive:
        pet.life_stage = "dead"
        pet.is_sleeping = False
        pet.wants_attention = False
        pet.attention_real = False


def apply_ticks(pet: Pet, ticks: int, rng: random.Random, hour_fn=None) -> Pet:
    """Apply N minute-long ticks to the pet. Mutates and returns.
    `hour_fn(i)` returns the local wall hour at the i-th tick (0-indexed,
    after that minute elapses). If omitted the caller doesn't care about
    sleep timing and we treat every tick as a waking minute."""
    if ticks <= 0 or not pet.alive:
        return pet
    ticks = min(ticks, MAX_CATCHUP_TICKS)

    for i in range(ticks):
        if not pet.alive:
            break

        pet.age_minutes += 1
        hour = hour_fn(i) if hour_fn else 12  # default to "noon" = awake
        _handle_sleep_transitions(pet, hour)

        # Sleep effectively pauses decay. Hunger trickles down very
        # slowly (5% rate) so a long night doesn't bottom you out;
        # happiness doesn't decay at all while asleep — sleep is restful.
        if pet.is_sleeping:
            pet.hunger = clamp(pet.hunger - HUNGER_DECAY_PER_MIN * 0.05, 0, MAX_HEARTS)
        else:
            pet.hunger    = clamp(pet.hunger - HUNGER_DECAY_PER_MIN, 0, MAX_HEARTS)
            pet.happiness = clamp(pet.happiness - HAPPY_DECAY_PER_MIN, 0, MAX_HEARTS)
            pet.weight    = clamp(pet.weight - 0.005, 1, 99)

        if not pet.is_sleeping and pet.weight > 5 and rng.random() < 0.02:
            pet.poop_count = min(pet.poop_count + 1, 9)

        _handle_poop_sickness(pet, rng)
        _maybe_schedule_sickness(pet, rng)

        _life_stage_transition(pet)
        _maybe_call_for_attention(pet, rng)
        _expire_misbehaviour(pet)
        # Sleeping pets can't be "ignored" — defer mistake accrual until
        # they wake up. Same logic for death rolls.
        if not pet.is_sleeping:
            _accrue_need_mistakes(pet)
            _maybe_die(pet, rng)

    return pet


# ----------------------------------------------------------------------
# Player actions.

def feed(pet: Pet, kind: str) -> tuple[Pet, str]:
    if not pet.alive:
        return pet, "pet is no longer with us"
    if pet.is_sleeping:
        return pet, "shh, pet is sleeping"
    if kind == "meal":
        if pet.hunger >= MAX_HEARTS - 0.01:
            pet.care_mistakes += 1
            pet.stage_care_mistakes += 1
            return pet, "pet refused — already full"
        pet.hunger = clamp(pet.hunger + 1.0, 0, MAX_HEARTS)
        pet.weight = clamp(pet.weight + 1.5, 1, 99)
        _clear_attention_if_satisfied(pet)
        return pet, "fed a meal"
    if kind == "snack":
        pet.happiness = clamp(pet.happiness + 1.0, 0, MAX_HEARTS)
        pet.weight = clamp(pet.weight + 0.6, 1, 99)
        pet.hunger = clamp(pet.hunger + 0.2, 0, MAX_HEARTS)
        _clear_attention_if_satisfied(pet)
        return pet, "fed a snack"
    return pet, f"unknown food: {kind}"


def play_can_start(pet: Pet) -> tuple[bool, str]:
    if not pet.alive:
        return False, "pet is no longer with us"
    if pet.is_sleeping:
        return False, "shh, pet is sleeping"
    return True, ""


def play_finish(pet: Pet, wins: int) -> tuple[Pet, str]:
    """Apply the outcome of a 5-round left/right game."""
    if not pet.alive or pet.is_sleeping:
        return pet, "pet can't play right now"
    if pet.life_stage in ("egg",):
        return pet, "egg can't play yet"
    wins = max(0, min(5, int(wins)))
    pet.weight = clamp(pet.weight - 0.4, 1, 99)
    if wins >= 3:
        pet.happiness = clamp(pet.happiness + 1.0, 0, MAX_HEARTS)
        msg = f"won {wins}/5 — happy!"
    else:
        pet.happiness = clamp(pet.happiness - 0.3, 0, MAX_HEARTS)
        msg = f"only {wins}/5 — pet sulks"
    _clear_attention_if_satisfied(pet)
    return pet, msg


def clean(pet: Pet) -> tuple[Pet, str]:
    if pet.poop_count == 0:
        return pet, "nothing to clean"
    pet.poop_count = 0
    pet.poop_oldest_min = -1
    _clear_attention_if_satisfied(pet)
    return pet, "cleaned up"


def heal(pet: Pet) -> tuple[Pet, str]:
    if not pet.is_sick:
        pet.care_mistakes += 1
        pet.stage_care_mistakes += 1
        return pet, "pet wasn't sick"
    pet.sick_doses_needed = max(0, pet.sick_doses_needed - 1)
    if pet.sick_doses_needed == 0:
        pet.is_sick = False
        _clear_attention_if_satisfied(pet)
        return pet, "medicine worked"
    return pet, f"medicine didn't fully work — {pet.sick_doses_needed} more dose(s) needed"


def discipline(pet: Pet) -> tuple[Pet, str]:
    if not pet.alive:
        return pet, "pet is no longer with us"
    if pet.is_sleeping:
        return pet, "pet is asleep — let it rest"
    if not pet.wants_attention:
        # Scolding nothing is a small care mistake.
        pet.care_mistakes += 1
        pet.stage_care_mistakes += 1
        pet.happiness = clamp(pet.happiness - 0.3, 0, MAX_HEARTS)
        return pet, "pet wasn't asking for attention"
    if pet.attention_real:
        # Pet had a real need; scolding is a real care mistake.
        pet.care_mistakes += 2
        pet.stage_care_mistakes += 2
        pet.happiness = clamp(pet.happiness - 1.0, 0, MAX_HEARTS)
        pet.wants_attention = False
        pet.attention_real = False
        pet.attention_started_min = -1
        return pet, "that wasn't misbehaviour — care mistake"
    # False alarm: canonical +25% discipline.
    pet.discipline = clamp(pet.discipline + 25.0, 0, 100)
    pet.wants_attention = False
    pet.attention_started_min = -1
    return pet, f"disciplined ({int(pet.discipline)}%)"


SURPRISE_EVENTS: list[tuple[str, str, dict]] = [
    # (key, message, effect-payload)
    ("found_coin",       "🪙 found a shiny coin!",         {"happy": +0.5}),
    ("butterfly",        "🦋 a butterfly!",                  {"happy": +0.4}),
    ("rainbow",          "🌈 saw a rainbow!",                {"happy": +0.6}),
    ("hug",              "🤗 someone gave a hug!",           {"happy": +0.7}),
    ("treat",            "🎁 a mystery treat!",              {"hunger": +0.5, "happy": +0.3}),
    ("nap_dream",        "💭 sweet dream!",                  {"happy": +0.3}),
    ("stomach",          "😣 small tummy ache",              {"happy": -0.4}),
    ("hiccup",           "*hic!* hiccups",                   {"happy": -0.1}),
    ("song",             "🎵 hummed a tune",                 {"happy": +0.5}),
    ("trip",             "tripped over nothing",             {"happy": -0.2}),
]


def maybe_surprise(pet: Pet, rng: random.Random) -> tuple[Pet, dict | None]:
    """Roll for a random surprise event. Called from the tick loop.
    ~0.001/min ≈ once every ~17 hours of awake time."""
    if not pet.alive or pet.is_sleeping or pet.life_stage == "egg":
        return pet, None
    if rng.random() >= 0.0008:
        return pet, None
    key, msg, effect = rng.choice(SURPRISE_EVENTS)
    if effect.get("happy"):
        pet.happiness = clamp(pet.happiness + effect["happy"], 0, MAX_HEARTS)
    if effect.get("hunger"):
        pet.hunger = clamp(pet.hunger + effect["hunger"], 0, MAX_HEARTS)
    return pet, {"key": key, "msg": msg, "effect": effect}


def lights(pet: Pet) -> tuple[Pet, str]:
    pet.lights_off = not pet.lights_off
    if pet.lights_off and pet.is_sleeping:
        # Turning lights off while pet is sleeping clears the late-warning.
        pet.lights_late_warned = True
    return pet, "lights off" if pet.lights_off else "lights on"


def tap_egg(pet: Pet) -> tuple[Pet, dict, str]:
    """Tap an egg to fast-forward hatching. Three taps puts it at the
    egg→baby threshold; the next tick will transition it."""
    if pet.life_stage != "egg" or not pet.alive:
        return pet, {"hatched": False, "taps": 0}, "no egg to tap"
    pet.age_minutes = min(pet.age_minutes + 1, 3)
    taps = pet.age_minutes
    if taps >= 3:
        return pet, {"hatched": True, "taps": 3}, "the egg cracks open!"
    return pet, {"hatched": False, "taps": taps}, f"crack ({taps}/3)"
