"""Build multiplicative seasonality arrays per (market, date).

Given a SeasonalityFile, produce a dict `{(market, date): multiplier}` where
multiplier = dow_mult * payday_mult * product_of_event_multipliers. A market
of `[]` on an event means "all markets"; otherwise the event applies only to
those markets.

Kept standalone (no pandas) so tests are fast and the logic is scrutable.
"""

from __future__ import annotations

from datetime import date
from typing import Iterable

from .calendar import daterange, dow_name
from .config import SeasonalityFile


def build_multiplier_map(
    seasonality: SeasonalityFile,
    markets: Iterable[str],
    start: date,
    end: date,
) -> dict[tuple[str, date], float]:
    """Return {(market, date): multiplier} covering [start, end] for each market."""
    mkt_list = list(markets)
    out: dict[tuple[str, date], float] = {}

    for d in daterange(start, end):
        dow_mult = seasonality.dow_multiplier.get(dow_name(d), 1.0)
        is_payday = d.day in seasonality.payday_days
        payday_mult = seasonality.payday_uplift if is_payday else 1.0
        base = dow_mult * payday_mult

        for mk in mkt_list:
            event_mult = 1.0
            for ev in seasonality.events:
                if ev.start <= d <= ev.end:
                    if not ev.markets or mk in ev.markets:
                        event_mult *= ev.uplift_mult
            out[(mk, d)] = base * event_mult

    return out
