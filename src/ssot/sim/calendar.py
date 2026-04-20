"""Date-range helpers keyed to market timezones.

The engine works in market-local dates (same grain the existing `stg_platform_sales`
staging view targets via `DATE(create_time_utc, dm.timezone)`). To keep things
simple at daily granularity, we treat `date_local` as already-local and don't
round-trip through UTC; the projectors stamp whatever the connector's `Date`
column expects.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterator


def daterange(start: date, end: date) -> Iterator[date]:
    """Inclusive iterator over [start, end]."""
    if end < start:
        raise ValueError(f"end {end} before start {start}")
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def num_days(start: date, end: date) -> int:
    return (end - start).days + 1


def dow_name(d: date) -> str:
    # Matches SeasonalityFile.dow_multiplier keys
    return ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")[d.weekday()]
