"""Projection output must match the Supermetrics field list in config/sources.yaml."""

from __future__ import annotations

from datetime import date

import pytest

from ssot.config import load_sources
from ssot.sim.config import load_sim_config
from ssot.sim.engine import simulate
from ssot.sim.projections import REGISTRY
from ssot.sim.rng import make_rng


@pytest.fixture(scope="module")
def tiny_latent():
    cfg = load_sim_config(
        seed=42,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 3),
        markets=["ID", "SG"],
    )
    return cfg, simulate(cfg)


def _project(source: str, cfg, latent) -> list[dict]:
    rng = make_rng(cfg.seed).spawn("projections").spawn(source)
    return REGISTRY[source](latent, cfg, rng)


@pytest.mark.parametrize("source", [
    "tiktok_shop", "tiktok_ads", "shopee_commerce",
    "shopee_ads", "meta_cpas", "google_ads_shopee",
])
def test_projection_rows_include_all_expected_fields(tiny_latent, source):
    cfg, latent = tiny_latent
    rows = _project(source, cfg, latent)
    assert len(rows) > 0, f"{source} produced zero rows"
    expected = set(load_sources().sources[source].fields)
    # Every configured Supermetrics field must appear on every row (value may be None).
    for row in rows[:50]:  # sample
        missing = expected - set(row.keys())
        assert not missing, f"{source}: missing fields {missing}"


@pytest.mark.parametrize("source", [
    "tiktok_shop", "tiktok_ads", "shopee_commerce",
    "shopee_ads", "meta_cpas", "google_ads_shopee",
])
def test_projection_rows_carry_metadata_block(tiny_latent, source):
    cfg, latent = tiny_latent
    rows = _project(source, cfg, latent)
    meta_fields = {"_source_system", "_market", "_accounts", "_window_start", "_window_end"}
    for row in rows[:50]:
        assert meta_fields <= set(row.keys())
        # _source_system carries _sim suffix per PRD §12
        assert row["_source_system"].endswith("_sim")
        assert row["_market"] in cfg.brand.markets


def test_shopee_ads_voucher_subsidy_in_reasonable_range(tiny_latent):
    cfg, latent = tiny_latent
    rows = _project("shopee_ads", cfg, latent)
    for r in rows:
        # voucher_subsidy must be non-negative and <= spend
        assert r["Voucher_subsidy"] >= 0
        assert r["Voucher_subsidy"] <= r["Spend"] + 1e-6


def test_meta_cpas_all_rows_catalog_sales(tiny_latent):
    cfg, latent = tiny_latent
    rows = _project("meta_cpas", cfg, latent)
    assert all(r["Objective"] == "CATALOG_SALES" for r in rows)


def test_google_ads_campaign_names_prefixed_with_shp(tiny_latent):
    """Staging filters Google rows where Campaign_name STARTS_WITH 'SHP_'."""
    cfg, latent = tiny_latent
    rows = _project("google_ads_shopee", cfg, latent)
    assert all(r["Campaign_name"].startswith("SHP_") for r in rows), \
        "some Google rows would be filtered out by staging"


def test_google_ads_includes_demand_gen_and_video_campaign_types(tiny_latent):
    """Needed for the EVC story — upper-funnel Google campaigns generate EVC."""
    cfg, latent = tiny_latent
    rows = _project("google_ads_shopee", cfg, latent)
    types = {r["Campaign_type"] for r in rows}
    assert "DEMAND_GEN" in types
    assert "VIDEO" in types
    assert "SEARCH" in types


def test_tiktok_shop_order_lines_have_monotone_timestamps(tiny_latent):
    cfg, latent = tiny_latent
    rows = _project("tiktok_shop", cfg, latent)
    for r in rows[:100]:
        if r["Payment_time"]:
            assert r["Payment_time"] >= r["Order_create_time"]


def test_tiktok_shop_order_amount_equals_subtotal_plus_shipping(tiny_latent):
    cfg, latent = tiny_latent
    rows = _project("tiktok_shop", cfg, latent)
    for r in rows[:100]:
        # 0.02 tolerance — we round each field to 2dp independently so a cent can swing.
        assert abs(r["Order_amount"] - (r["Sub_total"] + r["Shipping_fee"])) < 0.02


def test_shopee_orders_respect_order_status_semantics(tiny_latent):
    cfg, latent = tiny_latent
    rows = _project("shopee_commerce", cfg, latent)
    for r in rows[:200]:
        if r["Order_status"] == "cancelled":
            assert r["Pay_time"] is None or r["Complete_time"] is None


def test_determinism_same_seed_byte_identical_rows(tiny_latent):
    """Running projection twice with same seed produces identical dict sequences."""
    cfg, latent = tiny_latent
    a = _project("shopee_ads", cfg, latent)
    # Re-simulate from config + run again
    latent_2 = simulate(cfg)
    b = _project("shopee_ads", cfg, latent_2)
    assert a == b, "shopee_ads projection is non-deterministic"
