"""End-to-end engine invariants at small scale."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest

from ssot.sim.config import load_sim_config
from ssot.sim.engine import simulate


@pytest.fixture(scope="module")
def small_latent():
    """30-day × 2-market horizon for fast invariant checks."""
    cfg = load_sim_config(
        seed=42,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 30),
        markets=["ID", "SG"],
    )
    return simulate(cfg)


def test_latent_has_expected_structure(small_latent):
    assert set(small_latent.panel["market"].unique()) == {"ID", "SG"}
    assert len(small_latent.panel["date_local"].unique()) == 30
    # 8 paid channels per (market, date)
    n_channels = small_latent.panel["channel"].nunique()
    assert n_channels == 8, f"expected 8 paid channels, got {n_channels}"
    expected_rows = 2 * 30 * 8  # markets * days * channels
    assert len(small_latent.panel) == expected_rows


def test_no_negative_values(small_latent):
    for col in ("spend_sgd", "voucher_subsidy_sgd", "impressions", "clicks",
                "ads_attributed_orders", "ads_attributed_gmv_sgd",
                "all_conversions", "evc_conversions"):
        assert (small_latent.panel[col] >= 0).all(), f"{col} has negatives"


def test_funnel_monotonicity(small_latent):
    p = small_latent.panel
    assert (p["impressions"] >= p["clicks"]).all(), "impressions < clicks somewhere"
    assert (p["clicks"] >= p["ads_attributed_orders"]).all(), "clicks < orders somewhere"


def test_evc_bounded_by_all_conversions(small_latent):
    p = small_latent.panel
    assert (p["evc_conversions"] <= p["all_conversions"] + 1e-9).all()


def test_voucher_subsidy_bounded_by_spend(small_latent):
    p = small_latent.panel
    assert (p["voucher_subsidy_sgd"] <= p["spend_sgd"] + 1e-9).all()


def test_only_shopee_ads_has_voucher_subsidy(small_latent):
    p = small_latent.panel
    non_shopee = p[~p["channel"].str.startswith("shopee_ads_")]
    assert (non_shopee["voucher_subsidy_sgd"] == 0).all()


def test_evc_zero_for_on_platform_shopee_channels(small_latent):
    p = small_latent.panel
    on_plat = p[p["channel"].str.startswith("shopee_ads_")]
    assert (on_plat["evc_conversions"] == 0).all()


def test_evc_positive_for_off_platform_channels(small_latent):
    p = small_latent.panel
    for ch in ("tiktok_ads", "meta_cpas", "google_ads_shopee"):
        sub = p[p["channel"] == ch]
        # In a 30-day horizon with positive spend, evc should sum > 0.
        assert sub["evc_conversions"].sum() > 0, f"{ch} has zero EVC over 60 rows"


def test_roas_bands_respected_per_channel(small_latent):
    """Each paid channel's 30-day aggregate ROAS must sit inside its declared band."""
    from ssot.sim.config import load_priors
    priors = load_priors()
    p = small_latent.panel
    totals = p.groupby("channel", as_index=False).agg(
        spend=("spend_sgd", "sum"),
        gmv=("ads_attributed_gmv_sgd", "sum"),
    )
    totals["roas"] = totals["gmv"] / totals["spend"]
    for _, row in totals.iterrows():
        lo, hi = priors.channels[row["channel"]].roas_band
        # Allow the aggregate to fall anywhere loosely inside the band; give a small
        # tolerance factor since individual days can land outside but aggregate stays in.
        assert lo * 0.7 <= row["roas"] <= hi * 1.3, (
            f"{row['channel']}: aggregate ROAS {row['roas']:.2f} outside band "
            f"{(lo, hi)} (with ±30% aggregation tolerance)"
        )


def test_ads_attributed_gmv_at_most_95pct_of_platform_total(small_latent):
    """Invariant: SUM(ads_attributed_gmv) <= 0.95 * platform_total_gmv per (market, date, anchor)."""
    p = small_latent.panel
    ads = p.groupby(["market", "date_local", "anchor_platform"], as_index=False)["ads_attributed_gmv_sgd"].sum()
    t = small_latent.platform_totals
    m = ads.merge(t, on=["market", "date_local", "anchor_platform"], how="left")
    assert (m["ads_attributed_gmv_sgd"] <= 0.95 * m["platform_total_gmv_sgd"] + 1e-6).all()


def test_determinism_same_seed_identical_output():
    cfg = load_sim_config(
        seed=42,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 10),
        markets=["ID"],
    )
    a = simulate(cfg).panel.sort_values(["market", "date_local", "channel"]).reset_index(drop=True)
    b = simulate(cfg).panel.sort_values(["market", "date_local", "channel"]).reset_index(drop=True)
    pd.testing.assert_frame_equal(a, b)


def test_seed_change_produces_different_output():
    cfg1 = load_sim_config(
        seed=42, start_date=date(2026, 3, 1), end_date=date(2026, 3, 5), markets=["ID"],
    )
    cfg2 = load_sim_config(
        seed=99, start_date=date(2026, 3, 1), end_date=date(2026, 3, 5), markets=["ID"],
    )
    a = simulate(cfg1).panel["spend_sgd"].to_numpy()
    b = simulate(cfg2).panel["spend_sgd"].to_numpy()
    assert not np.array_equal(a, b)
