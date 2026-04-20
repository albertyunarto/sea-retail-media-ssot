"""Split latent totals across finer grains (SKU, campaign, ad_type, keyword).

Each allocator takes a total (scalar or array) and returns a proportional
breakdown. Splits use Dirichlet draws for smooth per-day variation that sums
to the total; Zipf is used for keyword long-tails.
"""

from __future__ import annotations

import numpy as np

from .config import Brand, SKU
from .rng import Rng


# --------------------------------------------------------------------------
# SKU allocation — category-weighted Dirichlet
# --------------------------------------------------------------------------
def sku_weights(brand: Brand, concentration: float = 5.0) -> dict[str, float]:
    """Fixed per-SKU allocation weights derived from category share / count.

    Each SKU in category c gets base weight = category.base_demand_share /
    len(category.skus), then Dirichlet concentration parameter = weight *
    concentration is used when drawing per-day splits.
    """
    weights: dict[str, float] = {}
    for cat in brand.categories:
        if not cat.skus:
            continue
        w = cat.base_demand_share / len(cat.skus)
        for sku in cat.skus:
            weights[sku.sku_id] = w * concentration
    return weights


def draw_sku_split(rng: Rng, brand: Brand) -> dict[str, float]:
    """One Dirichlet draw over SKUs that sums to 1.0."""
    weights = sku_weights(brand)
    skus = list(weights.keys())
    alpha = np.array([weights[s] for s in skus], dtype=float)
    props = rng.dirichlet(alpha)
    return dict(zip(skus, props.tolist()))


# --------------------------------------------------------------------------
# Ad_type allocation (Shopee)
# --------------------------------------------------------------------------
# Matches the SQL CASE in mart.daily_channel_panel for Shopee Ads.
SHOPEE_AD_TYPES: tuple[str, ...] = (
    "product_search",
    "shop_search",
    "targeting",
    "gmv_max",
    "affiliate",
)

SHOPEE_AD_TYPE_BASE_WEIGHT: dict[str, float] = {
    "product_search": 0.38,
    "shop_search":    0.14,
    "targeting":      0.20,
    "gmv_max":        0.22,
    "affiliate":      0.06,
}


# --------------------------------------------------------------------------
# Google campaign_type allocation (SEARCH / PMAX / SHOPPING / DEMAND_GEN / VIDEO)
# --------------------------------------------------------------------------
GOOGLE_CAMPAIGN_TYPES: tuple[str, ...] = ("SEARCH", "PMAX", "SHOPPING", "DEMAND_GEN", "VIDEO")

GOOGLE_CAMPAIGN_TYPE_WEIGHTS: dict[str, float] = {
    "SEARCH":     0.35,
    "PMAX":       0.25,
    "SHOPPING":   0.15,
    "DEMAND_GEN": 0.15,
    "VIDEO":      0.10,
}

# Upper-funnel (DEMAND_GEN, VIDEO) is where EVC lives disproportionately.
GOOGLE_CAMPAIGN_EVC_WEIGHT: dict[str, float] = {
    "SEARCH":     0.02,
    "PMAX":       0.20,
    "SHOPPING":   0.05,
    "DEMAND_GEN": 0.45,
    "VIDEO":      0.60,
}


# --------------------------------------------------------------------------
# Keyword long tail — Zipf
# --------------------------------------------------------------------------
def zipf_weights(n: int, a: float = 1.3) -> np.ndarray:
    """Unnormalized Zipf weights for n items; higher a -> sharper long tail."""
    ranks = np.arange(1, n + 1, dtype=float)
    return ranks ** (-a)


# --------------------------------------------------------------------------
# TikTok Shop traffic source
# --------------------------------------------------------------------------
TIKTOK_SHOP_TRAFFIC_WEIGHTS: dict[str, float] = {
    "LIVE":         0.35,
    "VIDEO":        0.30,
    "PRODUCT_CARD": 0.15,
    "SEARCH":       0.10,
    "MALL":         0.08,
    "AFFILIATE":    0.02,
}


# --------------------------------------------------------------------------
# Shopee traffic source (from orders; values documented in seed_traffic_source)
# --------------------------------------------------------------------------
SHOPEE_TRAFFIC_WEIGHTS: dict[str, float] = {
    "organic":        0.45,
    "search":         0.20,
    "feed":           0.10,
    "recommendation": 0.10,
    "ads":            0.13,
    "affiliate":      0.02,
}


def pick_sku_for_category(rng: Rng, brand: Brand, category_id: str) -> SKU:
    """Uniformly pick one SKU from a specific category."""
    cat = next((c for c in brand.categories if c.id == category_id), None)
    if not cat or not cat.skus:
        raise ValueError(f"no SKUs in category {category_id}")
    idx = int(rng.gen.integers(0, len(cat.skus)))
    return cat.skus[idx]


def pick_sku_weighted(rng: Rng, brand: Brand) -> SKU:
    """Pick a SKU weighted by category.base_demand_share (uniform within category)."""
    cats = brand.categories
    cat_weights = np.array([c.base_demand_share for c in cats], dtype=float)
    cat_weights = cat_weights / cat_weights.sum()
    cat_idx = int(rng.choice(len(cats), p=cat_weights))
    cat = cats[cat_idx]
    sku_idx = int(rng.gen.integers(0, len(cat.skus)))
    return cat.skus[sku_idx]
