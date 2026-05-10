"""Single source of truth for "now". Wraps time.time() with an in-memory
offset so dev-mode fast-forward can shift the clock for testing without
touching real time. The container's TZ is the user's local time, so
datetime.fromtimestamp returns local-clock dates already."""

from __future__ import annotations

import datetime
import time

_offset_ms = 0


def now_ms() -> int:
    return int(time.time() * 1000) + _offset_ms


def now_dt() -> datetime.datetime:
    return datetime.datetime.fromtimestamp(now_ms() / 1000)


def local_hour_at(ts_ms: int) -> int:
    return datetime.datetime.fromtimestamp(ts_ms / 1000).hour


def offset_minutes() -> int:
    return _offset_ms // 60_000


def advance(minutes: int) -> None:
    global _offset_ms
    _offset_ms += int(minutes) * 60_000


def reset() -> None:
    global _offset_ms
    _offset_ms = 0
