"""Projectors: turn engine LatentState into Supermetrics-shaped row dicts.

Each projector exposes a `project(latent, brand, cfg, rng) -> list[dict]`.
Dispatch via REGISTRY keyed by the source name from `config/sources.yaml`.

Rows emitted here are *pre-enriched* with `_source_system`, `_market`,
`_accounts`, `_window_start`, `_window_end` — matching the shape the real
`extractors.generic_extract` would produce. That way both the disk-ingest
path and the direct-BQ path are byte-symmetric.
"""

from __future__ import annotations

from typing import Callable

from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from . import (
    google_ads_shopee,
    meta_cpas,
    shopee_ads,
    shopee_commerce,
    tiktok_ads,
    tiktok_shop,
)


Projector = Callable[[LatentState, SimConfig, Rng], list[dict]]


REGISTRY: dict[str, Projector] = {
    "tiktok_shop":       tiktok_shop.project,
    "tiktok_ads":        tiktok_ads.project,
    "shopee_commerce":   shopee_commerce.project,
    "shopee_ads":        shopee_ads.project,
    "meta_cpas":         meta_cpas.project,
    "google_ads_shopee": google_ads_shopee.project,
}
