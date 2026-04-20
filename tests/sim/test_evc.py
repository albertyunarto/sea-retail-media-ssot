"""EVC derivation invariants."""

from __future__ import annotations

from datetime import date

import pytest

from ssot.sim.config import load_sim_config
from ssot.sim.engine import simulate
from ssot.sim.evc import (
    EVC_REGISTRY,
    derive_all_evc,
    project_google,
    project_meta,
    project_tiktok,
)
from ssot.sim.rng import make_rng


@pytest.fixture(scope="module")
def small_latent():
    cfg = load_sim_config(
        seed=42,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 14),
        markets=["ID", "SG"],
    )
    return cfg, simulate(cfg)


def test_evc_registry_has_three_platforms():
    assert set(EVC_REGISTRY.keys()) == {"google", "meta", "tiktok"}


def test_evc_rows_present_for_every_platform(small_latent):
    cfg, latent = small_latent
    sets = derive_all_evc(latent, cfg, make_rng(42).spawn("evc"))
    for p in ("google", "meta", "tiktok"):
        assert len(sets[p]) > 0, f"{p} produced no EVC rows"


def test_evc_google_has_engaged_view_rows(small_latent):
    cfg, latent = small_latent
    rows = project_google(latent, cfg, make_rng(42).spawn("google"))
    ad_events = {r["ad_event_type"] for r in rows}
    assert "engaged_view" in ad_events, "EVC story needs engaged_view events"
    assert "click_through" in ad_events


def test_evc_meta_never_emits_deprecated_windows(small_latent):
    """Post-January-2026 Meta only returns {1d_click, 7d_click, 1d_view, 1d_ev}.
    7d_view and 28d_view MUST NOT appear."""
    cfg, latent = small_latent
    rows = project_meta(latent, cfg, make_rng(42).spawn("meta"))
    windows = {r["attribution_window"] for r in rows}
    assert windows.issubset({"1d_click", "7d_click", "1d_view", "1d_ev"}), \
        f"deprecated window emitted: {windows}"
    # And the EVC bucket is 1d_ev specifically.
    assert "1d_ev" in windows


def test_evc_tiktok_emits_all_three_attribution_types(small_latent):
    cfg, latent = small_latent
    rows = project_tiktok(latent, cfg, make_rng(42).spawn("tiktok"))
    types = {r["attribution_type"] for r in rows}
    assert types == {"CTA", "VTA", "EVTA"}, f"expected CTA/VTA/EVTA, got {types}"


def test_evc_bounded_by_all_conversions_google(small_latent):
    """Aggregate: sum(evc) <= sum(all_conversions). By construction the engine's
    evc_conversions column is <= all_conversions per row, so the EVC projector
    cannot emit more than what was sampled."""
    cfg, latent = small_latent
    rows = project_google(latent, cfg, make_rng(42).spawn("google"))
    total_all = sum(r["all_conversions"] for r in rows)
    # EVC sub-rows have ad_event_type in {engaged_view, view_through}
    total_evc_rows = sum(r["conversions"] for r in rows
                        if r["ad_event_type"] in ("engaged_view", "view_through"))
    # Google engaged_view conversions are derived from the engine's evc_conversions;
    # they must never exceed the channel's total all_conversions.
    engine_total_all = latent.panel[latent.panel["channel"] == "google_ads_shopee"]["all_conversions"].sum()
    engine_total_evc = latent.panel[latent.panel["channel"] == "google_ads_shopee"]["evc_conversions"].sum()
    assert engine_total_evc <= engine_total_all
    # Total in projector must stay roughly consistent (projector just splits).
    assert total_evc_rows <= engine_total_all + 1


def test_evc_rows_include_source_system_sim_suffix(small_latent):
    cfg, latent = small_latent
    sets = derive_all_evc(latent, cfg, make_rng(42).spawn("evc"))
    for platform, rows in sets.items():
        for r in rows[:10]:
            assert r["_source_system"].endswith("_sim"), f"{platform}: {r['_source_system']}"


def test_determinism_same_seed_identical_evc(small_latent):
    cfg, _ = small_latent
    latent_a = simulate(cfg)
    latent_b = simulate(cfg)
    a = derive_all_evc(latent_a, cfg, make_rng(42).spawn("evc"))
    b = derive_all_evc(latent_b, cfg, make_rng(42).spawn("evc"))
    for p in ("google", "meta", "tiktok"):
        assert a[p] == b[p], f"{p}: EVC projection non-deterministic"


def test_transform_order_contains_evc_stage():
    """The `ssot transform --stage evc` path requires ORDER to include 'evc'."""
    from ssot.transform import ORDER
    assert "evc" in ORDER
    # 'evc' must come AFTER 'mart' so mart.daily_channel_panel is ready.
    assert ORDER.index("evc") > ORDER.index("mart")


def test_transform_substitutions_include_evc_dataset():
    import os
    os.environ.setdefault("GCP_PROJECT", "test-project")
    from ssot.transform import _substitutions
    subs = _substitutions()
    assert "EVC_DATASET" in subs
    assert subs["EVC_DATASET"] == "raw_custom_apis"
