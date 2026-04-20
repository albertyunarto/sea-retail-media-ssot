"""Phase 1: round-trip config YAMLs into Pydantic models."""

from __future__ import annotations

from datetime import date

import pytest

from ssot.sim.config import (
    Brand,
    ChannelPrior,
    PriorsFile,
    ScenariosFile,
    SeasonalityFile,
    load_brand,
    load_priors,
    load_scenarios,
    load_seasonality,
    load_sim_config,
)


def test_brand_loads_32_skus_across_4_categories():
    brand: Brand = load_brand()
    assert brand.name == "Elysium Home Care"
    assert set(brand.markets) == {"ID", "TH", "VN", "MY", "SG", "PH"}
    assert len(brand.categories) == 4
    skus = brand.all_skus()
    assert len(skus) == 32, f"expected 32 SKUs, got {len(skus)}"
    # SKU IDs unique
    ids = [s.sku_id for s in skus]
    assert len(set(ids)) == len(ids), "duplicate sku_ids"
    # 8 per category
    for cat in brand.categories:
        assert len(cat.skus) == 8, f"category {cat.id} has {len(cat.skus)} SKUs, want 8"
    # Category shares sum ~ 1.0
    share_sum = sum(c.base_demand_share for c in brand.categories)
    assert 0.99 <= share_sum <= 1.01, f"category shares sum to {share_sum}, want ~1.0"


def test_priors_covers_all_paid_channels():
    priors: PriorsFile = load_priors()
    expected_channels = {
        "shopee_ads_product_search",
        "shopee_ads_shop_search",
        "shopee_ads_targeting",
        "shopee_ads_gmv_max",
        "shopee_ads_affiliate",
        "tiktok_ads",
        "meta_cpas",
        "google_ads_shopee",
    }
    assert expected_channels <= set(priors.channels.keys())
    # Organic platforms present
    assert {"shopee", "tiktok_shop"} <= set(priors.organic.keys())


def test_priors_roas_bands_cover_baseline():
    """Baseline ROAS must sit inside its declared band (sanity for invariants)."""
    priors = load_priors()
    for name, ch in priors.channels.items():
        lo, hi = ch.roas_band
        assert lo <= ch.baseline_roas <= hi, f"{name}: {ch.baseline_roas} not in {ch.roas_band}"


def test_evc_coverage_only_on_offplatform_channels():
    """EVC is an off-platform (Google/Meta/TikTok Ads) concept. On-platform Shopee
    channels must not emit EVC."""
    priors = load_priors()
    for name in ("shopee_ads_product_search", "shopee_ads_shop_search",
                 "shopee_ads_targeting", "shopee_ads_gmv_max", "shopee_ads_affiliate"):
        assert priors.channels[name].evc_coverage_pct is None, f"{name} should not have EVC"
    for name in ("tiktok_ads", "meta_cpas", "google_ads_shopee"):
        assert priors.channels[name].evc_coverage_pct is not None, f"{name} missing EVC coverage"


def test_seasonality_events_cover_mega_sales():
    seas: SeasonalityFile = load_seasonality()
    event_names = {e.name for e in seas.events}
    assert any("11.11" in n for n in event_names), "missing 11.11 event"
    assert any("12.12" in n for n in event_names), "missing 12.12 event"
    assert any("Ramadan" in n for n in event_names), "missing Ramadan event"
    assert any("Hari Raya" in n for n in event_names), "missing Hari Raya event"


def test_seasonality_dates_well_ordered():
    seas = load_seasonality()
    for e in seas.events:
        assert e.start <= e.end, f"{e.name} has start>end"


def test_scenarios_load_six_overlays():
    scn: ScenariosFile = load_scenarios()
    expected = {"competitor_launch", "supply_shortage", "algo_change",
                "viral_moment", "price_war", "category_headwind"}
    assert expected <= set(scn.scenarios.keys())


def test_sim_config_assembles_all_sections():
    cfg = load_sim_config(
        seed=42,
        start_date=date(2025, 10, 22),
        end_date=date(2026, 4, 20),
    )
    assert cfg.seed == 42
    assert cfg.brand.name == "Elysium Home Care"
    assert len(cfg.priors.channels) >= 8
    assert len(cfg.seasonality.events) > 0
    # default effective_markets falls back to brand.markets
    assert cfg.effective_markets() == cfg.brand.markets


def test_sim_config_rejects_reversed_dates():
    with pytest.raises(Exception):
        load_sim_config(seed=42, start_date=date(2026, 4, 20), end_date=date(2026, 4, 19))


def test_channel_prior_rejects_reversed_roas_band():
    with pytest.raises(Exception):
        ChannelPrior(
            adstock_halflife_days=3,
            hill_shape=1.8,
            baseline_roas=5.0,
            roas_band=(8.0, 3.0),
            cpm_sgd=2.0,
            ctr=0.02,
            cvr=0.05,
            daily_spend_sgd_baseline=100.0,
        )
