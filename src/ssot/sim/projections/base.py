"""Shared helpers for projectors."""

from __future__ import annotations

from datetime import date

# Flat indicative SGD -> local-currency multipliers. Kept in sync with the
# dim_fx_rate seed (sql/seeds/02_dim_fx_rate.sql) at the `usd_rate / 1.33`
# relationship. SGD stays 1.0.
SGD_TO_LOCAL: dict[str, float] = {
    "ID": 16800.0 / 1.33,  # IDR
    "TH":    36.0 / 1.33,  # THB
    "VN": 25400.0 / 1.33,  # VND
    "MY":     4.60 / 1.33, # MYR
    "SG":     1.0,         # SGD
    "PH":    56.0 / 1.33,  # PHP
}

MARKET_CURRENCY: dict[str, str] = {
    "ID": "IDR",
    "TH": "THB",
    "VN": "VND",
    "MY": "MYR",
    "SG": "SGD",
    "PH": "PHP",
}


def sgd_to_local(market: str, sgd_amount: float) -> float:
    return sgd_amount * SGD_TO_LOCAL.get(market, 1.0)


def metadata(
    *,
    source_name: str,
    market: str,
    accounts: list[str],
    window_start: date,
    window_end: date,
) -> dict:
    """Produce the `_source_system` / `_market` / `_accounts` / `_window_*`
    pre-enrichment block. `_source_system` uses a `_sim` suffix so the table
    column clearly identifies rows as simulated data (per PRD-A §12)."""
    return {
        "_source_system": f"{source_name}_sim",
        "_market": market,
        "_accounts": ",".join(accounts),
        "_window_start": window_start.isoformat(),
        "_window_end": window_end.isoformat(),
    }


def account_id_for(source_name: str, market: str) -> str:
    """Deterministic synthetic account/advertiser/shop ID per (source, market).

    The real extractors fan out once per account in markets.yaml; the generator
    picks a single canonical ID per market so generated rows agree with what
    a populated markets.yaml would carry post-demo.
    """
    prefix_map = {
        "tiktok_shop":       "tts",
        "tiktok_ads":        "tta",
        "shopee_commerce":   "shp",
        "shopee_ads":        "shpa",
        "meta_cpas":         "act",
        "google_ads_shopee": "aw",
    }
    prefix = prefix_map.get(source_name, source_name)
    return f"{prefix}-sim-{market.lower()}-000001"
