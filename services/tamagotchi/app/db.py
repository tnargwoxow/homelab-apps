"""SQLite persistence. Single-writer, no connection pool needed."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path

from app.game import Pet, new_pet

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None
_path: Path | None = None


SCHEMA = """
CREATE TABLE IF NOT EXISTS pet (
    id                       INTEGER PRIMARY KEY,
    name                     TEXT NOT NULL,
    born_at                  INTEGER NOT NULL,
    last_tick                INTEGER NOT NULL,
    age_minutes              INTEGER NOT NULL,
    age_years                INTEGER NOT NULL DEFAULT 0,
    generation               INTEGER NOT NULL DEFAULT 1,
    life_stage               TEXT NOT NULL,
    character                TEXT NOT NULL DEFAULT 'egg',
    hunger                   REAL NOT NULL,
    happiness                REAL NOT NULL,
    discipline               REAL NOT NULL,
    weight                   REAL NOT NULL,
    poop_count               INTEGER NOT NULL,
    poop_oldest_min          INTEGER NOT NULL DEFAULT -1,
    is_sleeping              INTEGER NOT NULL,
    sleep_start_min          INTEGER NOT NULL DEFAULT -1,
    lights_off               INTEGER NOT NULL,
    lights_late_warned       INTEGER NOT NULL DEFAULT 0,
    is_sick                  INTEGER NOT NULL,
    sick_doses_needed        INTEGER NOT NULL DEFAULT 0,
    next_sickness_min        INTEGER NOT NULL DEFAULT -1,
    alive                    INTEGER NOT NULL,
    care_mistakes            REAL NOT NULL,
    stage_care_mistakes      INTEGER NOT NULL DEFAULT 0,
    stage_started_min        INTEGER NOT NULL DEFAULT 0,
    wants_attention          INTEGER NOT NULL DEFAULT 0,
    attention_real           INTEGER NOT NULL DEFAULT 0,
    attention_started_min    INTEGER NOT NULL DEFAULT -1,
    created_at               INTEGER NOT NULL,
    updated_at               INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pet_event (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id      INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    payload     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pet_event_pet_ts ON pet_event(pet_id, ts);

CREATE TABLE IF NOT EXISTS achievement (
    id          TEXT PRIMARY KEY,
    earned_at   INTEGER NOT NULL,
    pet_id      INTEGER NOT NULL,
    generation  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lineage (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    generation    INTEGER NOT NULL,
    name          TEXT NOT NULL,
    character     TEXT NOT NULL,
    peak_stage    TEXT NOT NULL,
    lifetime_min  INTEGER NOT NULL,
    care_mistakes INTEGER NOT NULL,
    born_at       INTEGER NOT NULL,
    died_at       INTEGER NOT NULL
);
"""


_NEW_COLUMNS = [
    ("wants_attention",        "INTEGER NOT NULL DEFAULT 0"),
    ("attention_real",         "INTEGER NOT NULL DEFAULT 0"),
    ("age_years",              "INTEGER NOT NULL DEFAULT 0"),
    ("generation",             "INTEGER NOT NULL DEFAULT 1"),
    ("poop_oldest_min",        "INTEGER NOT NULL DEFAULT -1"),
    ("sleep_start_min",        "INTEGER NOT NULL DEFAULT -1"),
    ("lights_late_warned",     "INTEGER NOT NULL DEFAULT 0"),
    ("sick_doses_needed",      "INTEGER NOT NULL DEFAULT 0"),
    ("next_sickness_min",      "INTEGER NOT NULL DEFAULT -1"),
    ("stage_care_mistakes",    "INTEGER NOT NULL DEFAULT 0"),
    ("stage_started_min",      "INTEGER NOT NULL DEFAULT 0"),
    ("attention_started_min",  "INTEGER NOT NULL DEFAULT -1"),
    ("character",              "TEXT NOT NULL DEFAULT 'egg'"),
]


def init(path: str) -> None:
    global _conn, _path
    _path = Path(path)
    _path.parent.mkdir(parents=True, exist_ok=True)
    _conn = sqlite3.connect(_path, check_same_thread=False, isolation_level=None)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("PRAGMA synchronous=NORMAL")
    _conn.executescript(SCHEMA)
    _migrate(_conn)


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after the initial schema, idempotently."""
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(pet)").fetchall()}
    for name, ddl in _NEW_COLUMNS:
        if name not in cols:
            conn.execute(f"ALTER TABLE pet ADD COLUMN {name} {ddl}")


def _row_to_pet(row: sqlite3.Row) -> Pet:
    return Pet(
        id=row["id"],
        name=row["name"],
        born_at=row["born_at"],
        last_tick=row["last_tick"],
        age_minutes=row["age_minutes"],
        age_years=row["age_years"],
        generation=row["generation"],
        life_stage=row["life_stage"],
        character=row["character"] or "egg",
        hunger=row["hunger"],
        happiness=row["happiness"],
        discipline=row["discipline"],
        weight=row["weight"],
        poop_count=row["poop_count"],
        poop_oldest_min=row["poop_oldest_min"],
        is_sleeping=bool(row["is_sleeping"]),
        sleep_start_min=row["sleep_start_min"],
        lights_off=bool(row["lights_off"]),
        lights_late_warned=bool(row["lights_late_warned"]),
        is_sick=bool(row["is_sick"]),
        sick_doses_needed=row["sick_doses_needed"],
        next_sickness_min=row["next_sickness_min"],
        alive=bool(row["alive"]),
        care_mistakes=int(row["care_mistakes"]),
        stage_care_mistakes=row["stage_care_mistakes"],
        stage_started_min=row["stage_started_min"],
        wants_attention=bool(row["wants_attention"]),
        attention_real=bool(row["attention_real"]),
        attention_started_min=row["attention_started_min"],
    )


def get_or_create_pet(now_ms: int) -> Pet:
    assert _conn is not None
    with _lock:
        row = _conn.execute("SELECT * FROM pet WHERE id = 1").fetchone()
        if row is None:
            pet = new_pet(now_ms)
            _insert_pet(pet, now_ms)
            log_event(pet.id, "hatched", {"name": pet.name, "generation": pet.generation}, ts=now_ms)
            return pet
        return _row_to_pet(row)


def save_pet(pet: Pet) -> None:
    assert _conn is not None
    now = int(time.time() * 1000)
    with _lock:
        _conn.execute(
            """
            UPDATE pet SET
                name=?, born_at=?, last_tick=?, age_minutes=?, age_years=?,
                generation=?, life_stage=?, character=?, hunger=?, happiness=?, discipline=?,
                weight=?, poop_count=?, poop_oldest_min=?,
                is_sleeping=?, sleep_start_min=?, lights_off=?, lights_late_warned=?,
                is_sick=?, sick_doses_needed=?, next_sickness_min=?,
                alive=?, care_mistakes=?, stage_care_mistakes=?, stage_started_min=?,
                wants_attention=?, attention_real=?, attention_started_min=?,
                updated_at=?
            WHERE id=?
            """,
            (
                pet.name, pet.born_at, pet.last_tick, pet.age_minutes, pet.age_years,
                pet.generation, pet.life_stage, pet.character, pet.hunger, pet.happiness, pet.discipline,
                pet.weight, pet.poop_count, pet.poop_oldest_min,
                int(pet.is_sleeping), pet.sleep_start_min, int(pet.lights_off), int(pet.lights_late_warned),
                int(pet.is_sick), pet.sick_doses_needed, pet.next_sickness_min,
                int(pet.alive), pet.care_mistakes, pet.stage_care_mistakes, pet.stage_started_min,
                int(pet.wants_attention), int(pet.attention_real), pet.attention_started_min,
                now, pet.id,
            ),
        )


def reset_pet(now_ms: int, name: str = "Tama") -> Pet:
    assert _conn is not None
    prev_gen = 1
    with _lock:
        row = _conn.execute("SELECT * FROM pet WHERE id = 1").fetchone()
        if row is not None:
            # Snapshot prior life to lineage so it survives the reset.
            _snapshot_lineage(row, now_ms)
            prev_gen = (row["generation"] or 1) + 1
        _conn.execute("DELETE FROM pet WHERE id = 1")
    pet = new_pet(now_ms, name=name, generation=prev_gen)
    _insert_pet(pet, now_ms)
    log_event(pet.id, "hatched", {"name": pet.name, "generation": pet.generation}, ts=now_ms)
    return pet


def _snapshot_lineage(row: sqlite3.Row, now_ms: int) -> None:
    assert _conn is not None
    lifetime_min = int(row["age_minutes"] or 0)
    with _lock:
        _conn.execute(
            """
            INSERT INTO lineage (
                generation, name, character, peak_stage,
                lifetime_min, care_mistakes, born_at, died_at
            ) VALUES (?,?,?,?,?,?,?,?)
            """,
            (
                row["generation"] or 1,
                row["name"] or "Tama",
                row["character"] or row["life_stage"] or "egg",
                row["life_stage"] or "egg",
                lifetime_min,
                int(row["care_mistakes"] or 0),
                row["born_at"] or now_ms,
                now_ms,
            ),
        )


def list_lineage() -> list[dict]:
    assert _conn is not None
    with _lock:
        rows = _conn.execute(
            "SELECT * FROM lineage ORDER BY generation DESC LIMIT 50"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "generation": r["generation"],
            "name": r["name"],
            "character": r["character"],
            "peak_stage": r["peak_stage"],
            "lifetime_min": r["lifetime_min"],
            "care_mistakes": r["care_mistakes"],
            "born_at": r["born_at"],
            "died_at": r["died_at"],
        }
        for r in rows
    ]


def _insert_pet(pet: Pet, now_ms: int) -> None:
    assert _conn is not None
    with _lock:
        _conn.execute(
            """
            INSERT INTO pet (
                id, name, born_at, last_tick, age_minutes, age_years, generation,
                life_stage, character, hunger, happiness, discipline, weight, poop_count,
                poop_oldest_min, is_sleeping, sleep_start_min, lights_off,
                lights_late_warned, is_sick, sick_doses_needed, next_sickness_min,
                alive, care_mistakes, stage_care_mistakes, stage_started_min,
                wants_attention, attention_real, attention_started_min,
                created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                pet.id, pet.name, pet.born_at, pet.last_tick, pet.age_minutes, pet.age_years, pet.generation,
                pet.life_stage, pet.character, pet.hunger, pet.happiness, pet.discipline, pet.weight, pet.poop_count,
                pet.poop_oldest_min, int(pet.is_sleeping), pet.sleep_start_min, int(pet.lights_off),
                int(pet.lights_late_warned), int(pet.is_sick), pet.sick_doses_needed, pet.next_sickness_min,
                int(pet.alive), pet.care_mistakes, pet.stage_care_mistakes, pet.stage_started_min,
                int(pet.wants_attention), int(pet.attention_real), pet.attention_started_min,
                now_ms, now_ms,
            ),
        )


def log_event(pet_id: int, kind: str, payload: dict | None = None, ts: int | None = None) -> None:
    assert _conn is not None
    if ts is None:
        ts = int(time.time() * 1000)
    with _lock:
        _conn.execute(
            "INSERT INTO pet_event (pet_id, ts, kind, payload) VALUES (?, ?, ?, ?)",
            (pet_id, ts, kind, json.dumps(payload or {})),
        )


def list_events(pet_id: int, limit: int = 50) -> list[dict]:
    assert _conn is not None
    with _lock:
        rows = _conn.execute(
            "SELECT id, ts, kind, payload FROM pet_event WHERE pet_id = ? ORDER BY id DESC LIMIT ?",
            (pet_id, limit),
        ).fetchall()
    return [
        {"id": r["id"], "ts": r["ts"], "kind": r["kind"], "payload": json.loads(r["payload"])}
        for r in rows
    ]


def close() -> None:
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


# === achievements ===

def list_achievements() -> list[dict]:
    assert _conn is not None
    with _lock:
        rows = _conn.execute(
            "SELECT id, earned_at, pet_id, generation FROM achievement ORDER BY earned_at DESC"
        ).fetchall()
    return [
        {"id": r["id"], "earned_at": r["earned_at"], "pet_id": r["pet_id"], "generation": r["generation"]}
        for r in rows
    ]


def grant_achievement(achievement_id: str, pet_id: int, generation: int) -> bool:
    """Grant achievement if not already earned. Returns True if newly granted."""
    assert _conn is not None
    now = int(time.time() * 1000)
    with _lock:
        existing = _conn.execute(
            "SELECT 1 FROM achievement WHERE id = ?", (achievement_id,)
        ).fetchone()
        if existing:
            return False
        _conn.execute(
            "INSERT INTO achievement (id, earned_at, pet_id, generation) VALUES (?, ?, ?, ?)",
            (achievement_id, now, pet_id, generation),
        )
    return True
