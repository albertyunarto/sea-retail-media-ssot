"""Generic, config-driven extractor.

Responsibilities:
  1) Resolve accounts per market from markets.yaml.
  2) Iterate markets (per-market call keeps Supermetrics field filter legal
     and keeps row volume bounded per page).
  3) Call Supermetrics with the rolling T−N window from sources.yaml.
  4) Tag each row with source_system, market, account_id, ingested_at.
  5) Append to the raw BQ table.

No per-source Python is needed unless a connector has quirky field shapes
(e.g. nested objects) — in which case add a module next to this one and
wire it in REGISTRY.
"""

from __future__ import annotations

from datetime import date, timedelta

from ..bq import BQClient
from ..config import SourceConfig, accounts_for, load_markets
from ..logging_conf import get_logger
from ..supermetrics import QueryWindow, SupermetricsClient

log = get_logger(__name__)


def generic_extract(
    source: SourceConfig,
    sm: SupermetricsClient,
    bq: BQClient,
    *,
    as_of: date | None = None,
    market: str | None = None,
) -> int:
    as_of = as_of or date.today()
    start = as_of - timedelta(days=source.n_days - 1)
    window = QueryWindow(start_date=start, end_date=as_of)

    markets_cfg = load_markets().markets
    markets = [market] if market else list(markets_cfg.keys())

    total = 0
    for mk in markets:
        accounts = accounts_for(source.name, mk)
        if not accounts:
            log.info("extract.skip.no_accounts", source=source.name, market=mk)
            continue
        rows = sm.query(source=source, accounts=accounts, window=window)
        if not rows:
            continue
        enriched = [
            {
                **r,
                "_source_system": source.name,
                "_market": mk,
                "_accounts": ",".join(accounts),
                "_window_start": window.start_date.isoformat(),
                "_window_end": window.end_date.isoformat(),
            }
            for r in rows
        ]
        loaded = bq.load_json_rows(enriched, source.raw_table)
        total += loaded
        log.info(
            "extract.market.done",
            source=source.name,
            market=mk,
            rows=loaded,
        )
    return total
