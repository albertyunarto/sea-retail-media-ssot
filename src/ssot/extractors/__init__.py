"""Per-source extractors. Each module defines an `extract(...)` callable.

To add a source: (a) add a block to config/sources.yaml,
(b) optionally add a module here if you need custom field post-processing,
(c) register it in REGISTRY below.
"""

from __future__ import annotations

from typing import Callable

from . import base

Extractor = Callable[..., int]

REGISTRY: dict[str, Extractor] = {
    # All six default to the generic base extractor driven by sources.yaml.
    # If a source needs custom logic, add a dedicated module and override here.
    "tiktok_shop": base.generic_extract,
    "tiktok_ads": base.generic_extract,
    "shopee_commerce": base.generic_extract,
    "shopee_ads": base.generic_extract,
    "meta_cpas": base.generic_extract,
    "google_ads_shopee": base.generic_extract,
}
