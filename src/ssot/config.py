"""Typed config loader for sources, markets, and taxonomy YAMLs."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


# ----------------------------------------------------------------------------
# sources.yaml — one block per Supermetrics connector
# ----------------------------------------------------------------------------
class SourceConfig(BaseModel):
    name: str  # logical name, e.g. "tiktok_ads"
    ds_id: str  # Supermetrics data-source code (e.g. "FA", "TT", "AW")
    ds_user: str | None = None
    raw_table: str  # target BQ table, e.g. "raw_supermetrics.tiktok_ads_daily"
    fields: list[str]  # Supermetrics field names to pull
    breakdowns: list[str] = Field(default_factory=list)  # break-down fields
    date_field: str = "Date"  # name of the date column returned
    date_range_type: Literal[
        "custom", "last_n_days", "last_n_days_including_today"
    ] = "last_n_days_including_today"
    n_days: int = 14  # rolling window re-read on each run
    filter_expressions: list[dict] = Field(default_factory=list)
    timeout_seconds: int = 600
    max_rows_per_call: int = 1_000_000
    # Post-extraction hints
    natural_keys: list[str] = Field(
        default_factory=list,
        description="Columns that form the natural key for dedup in raw.",
    )
    notes: str | None = None


class SourcesFile(BaseModel):
    sources: dict[str, SourceConfig]


# ----------------------------------------------------------------------------
# markets.yaml — which advertiser / shop IDs per market, per platform
# ----------------------------------------------------------------------------
class MarketAccounts(BaseModel):
    market: str
    timezone: str
    currency: str
    tiktok_ads: list[str] = Field(default_factory=list)
    shopee_ads: list[str] = Field(default_factory=list)
    meta_cpas: list[str] = Field(default_factory=list)
    google_ads: list[str] = Field(default_factory=list)
    shopee_commerce: list[str] = Field(default_factory=list)
    tiktok_shop: list[str] = Field(default_factory=list)


class MarketsFile(BaseModel):
    markets: dict[str, MarketAccounts]


# ----------------------------------------------------------------------------
# taxonomy.yaml — channel taxonomy mapping
# ----------------------------------------------------------------------------
class ChannelMapping(BaseModel):
    channel: str
    platform: str
    rule: str  # SQL-expressible rule, documented for humans


class TaxonomyFile(BaseModel):
    channels: list[ChannelMapping]


# ----------------------------------------------------------------------------
# loaders
# ----------------------------------------------------------------------------
def _load_yaml(path: Path) -> dict:
    with path.open() as f:
        return yaml.safe_load(f)


@lru_cache(maxsize=1)
def load_sources() -> SourcesFile:
    return SourcesFile(**_load_yaml(CONFIG_DIR / "sources.yaml"))


@lru_cache(maxsize=1)
def load_markets() -> MarketsFile:
    return MarketsFile(**_load_yaml(CONFIG_DIR / "markets.yaml"))


@lru_cache(maxsize=1)
def load_taxonomy() -> TaxonomyFile:
    return TaxonomyFile(**_load_yaml(CONFIG_DIR / "taxonomy.yaml"))


def accounts_for(source_name: str, market_code: str | None = None) -> list[str]:
    """Return the advertiser / shop IDs for a source, optionally filtered by market."""
    markets = load_markets().markets
    if market_code:
        m = markets.get(market_code)
        if not m:
            return []
        return getattr(m, source_name, []) or []
    out: list[str] = []
    for m in markets.values():
        out.extend(getattr(m, source_name, []) or [])
    return out
