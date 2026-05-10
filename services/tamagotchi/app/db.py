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
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    born_at         INTEGER NOT NULL,
    last_tick       INTEGER NOT NULL,
    age_minutes     INTEGER NOT NULL,
    life_stage      TEXT NOT NULL,
    hunger          REAL NOT NULL,
    happiness       REAL NOT NULL,
    discipline      REAL NOT NULL,
    weight          REAL NOT NULL,
    poop_count      INTEGER NOT NULL,
    is_sleeping     INTEGER NOT NULL,
    is_sick         INTEGER NOT NULL,
    alive           INTEGER NOT NULL,
    care_mistakes   REAL NOT NULL,
    lights_off      INTEGER NOT NULL,
    wants_attention INTEGER NOT NULL DEFAULT 0,
    attention_real  INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pet_event (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id      INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    payload     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pet_event_pet_ts ON pet_event(pet_id, ts);
"""


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
    if "wants_attention" not in cols:
        conn.execute("ALTER TABLE pet ADD COLUMN wants_attention INTEGER NOT NULL DEFAULT 0")
    if "attention_real" not in cols:
        conn.execute("ALTER TABLE pet ADD COLUMN attention_real INTEGER NOT NULL DEFAULT 0")


def _row_to_pet(row: sqlite3.Row) -> Pet:
    return Pet(
        id=row["id"],
        name=row["name"],
        born_at=row["born_at"],
        last_tick=row["last_tick"],
        age_minutes=row["age_minutes"],
        life_stage=row["life_stage"],
        hunger=row["hunger"],
        happiness=row["happiness"],
        discipline=row["discipline"],
        weight=row["weight"],
        poop_count=row["poop_count"],
        is_sleeping=bool(row["is_sleeping"]),
        is_sick=bool(row["is_sick"]),
        alive=bool(row["alive"]),
        care_mistakes=row["care_mistakes"],
        lights_off=bool(row["lights_off"]),
        wants_attention=bool(row["wants_attention"]),
        attention_real=bool(row["attention_real"]),
    )


def get_or_create_pet(now_ms: int) -> Pet:
    assert _conn is not None
    with _lock:
        row = _conn.execute("SELECT * FROM pet WHERE id = 1").fetchone()
        if row is None:
            pet = new_pet(now_ms)
            _insert_pet(pet, now_ms)
            log_event(pet.id, "hatched", {"name": pet.name}, ts=now_ms)
            return pet
        return _row_to_pet(row)


def save_pet(pet: Pet) -> None:
    assert _conn is not None
    now = int(time.time() * 1000)
    with _lock:
        _conn.execute(
            """
            UPDATE pet SET
                name=?, born_at=?, last_tick=?, age_minutes=?, life_stage=?,
                hunger=?, happiness=?, discipline=?, weight=?, poop_count=?,
                is_sleeping=?, is_sick=?, alive=?, care_mistakes=?, lights_off=?,
                wants_attention=?, attention_real=?,
                updated_at=?
            WHERE id=?
            """,
            (
                pet.name, pet.born_at, pet.last_tick, pet.age_minutes, pet.life_stage,
                pet.hunger, pet.happiness, pet.discipline, pet.weight, pet.poop_count,
                int(pet.is_sleeping), int(pet.is_sick), int(pet.alive), pet.care_mistakes,
                int(pet.lights_off),
                int(pet.wants_attention), int(pet.attention_real),
                now, pet.id,
            ),
        )


def reset_pet(now_ms: int, name: str = "Tama") -> Pet:
    assert _conn is not None
    with _lock:
        _conn.execute("DELETE FROM pet WHERE id = 1")
    pet = new_pet(now_ms, name=name)
    _insert_pet(pet, now_ms)
    log_event(pet.id, "hatched", {"name": pet.name}, ts=now_ms)
    return pet


def _insert_pet(pet: Pet, now_ms: int) -> None:
    assert _conn is not None
    with _lock:
        _conn.execute(
            """
            INSERT INTO pet (
                id, name, born_at, last_tick, age_minutes, life_stage,
                hunger, happiness, discipline, weight, poop_count,
                is_sleeping, is_sick, alive, care_mistakes, lights_off,
                wants_attention, attention_real,
                created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                pet.id, pet.name, pet.born_at, pet.last_tick, pet.age_minutes, pet.life_stage,
                pet.hunger, pet.happiness, pet.discipline, pet.weight, pet.poop_count,
                int(pet.is_sleeping), int(pet.is_sick), int(pet.alive), pet.care_mistakes,
                int(pet.lights_off),
                int(pet.wants_attention), int(pet.attention_real),
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
