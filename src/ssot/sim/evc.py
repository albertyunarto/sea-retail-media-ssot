"""EVC extension: derive view-assisted conversions from the engine's LatentState
and emit them in three custom-API shapes (Google / Meta / TikTok).

EVC is NOT sampled independently. It comes from the same `all_conversions` the
paid-ads projectors already emit, guaranteeing by construction that:

    evc_conversions <= all_conversions    (per row)
    SUM(evc) <= coverage_pct * SUM(all_conversions)    (per channel)

This is the core correctness property that makes the PRD-B "toggle EVC on/off"
story credible — the EVC number can never exceed what the platforms would
actually report.
"""

from __future__ import annotations

from datetime import date
from typing import Iterable

import numpy as np
import pandas as pd

from .config import SimConfig
from .engine import LatentState
from .projections.base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY
from .rng import Rng, make_rng

_EVC_CHANNELS = ("google_ads_shopee", "meta_cpas", "tiktok_ads")


# ---------------------------------------------------------------------------
# Projector: Google Ads custom-API shape
# ---------------------------------------------------------------------------
def project_google(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    df = latent.panel[latent.panel["channel"] == "google_ads_shopee"].reset_index(drop=True)
    if df.empty:
        return []
    out: list[dict] = []
    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        cust_id = account_id_for("google_ads_shopee", mk)
        meta = metadata(
            source_name="custom_google_ads_api", market=mk, accounts=[cust_id],
            window_start=cfg.start_date, window_end=cfg.end_date,
        )
        all_conv = float(r["all_conversions"])
        evc = float(r["evc_conversions"])
        clicks_conv = max(0.0, all_conv - evc)
        fx_value = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))
        # Split EVC across upper-funnel Google campaign types (DEMAND_GEN, VIDEO)
        # and the click-through conversions across all 4 types proportional to
        # taxonomy weights. Keeping this aggregated at (date, market, campaign_type)
        # is sufficient for the dashboard's EVC-toggle story.
        splits = {
            "SEARCH":     {"click": 0.40, "evc": 0.02},
            "PMAX":       {"click": 0.30, "evc": 0.20},
            "DEMAND_GEN": {"click": 0.15, "evc": 0.45},
            "VIDEO":      {"click": 0.15, "evc": 0.33},
        }
        for camp_type, w in splits.items():
            camp_id = f"cmp_{mk.lower()}_{camp_type.lower()}_01"
            camp_name = f"SHP_{camp_type}_{mk}_Always_On"
            ct = clicks_conv * w["click"]
            ev = evc * w["evc"]
            total_all = ct + ev
            if total_all == 0:
                continue
            out.append({
                "date":                  d.isoformat(),
                "customer_id":           cust_id,
                "campaign_id":           camp_id,
                "campaign_name":         camp_name,
                "campaign_type":         camp_type,
                "ad_event_type":         "click_through",
                "conversions":           round(ct, 4),
                "conversions_value":     round(fx_value * w["click"], 2),
                "all_conversions":       round(ct + ev, 4),
                "all_conversions_value": round(fx_value * (w["click"] + w["evc"]), 2),
                **meta,
            })
            if ev > 0:
                out.append({
                    "date":                  d.isoformat(),
                    "customer_id":           cust_id,
                    "campaign_id":           camp_id,
                    "campaign_name":         camp_name,
                    "campaign_type":         camp_type,
                    "ad_event_type":         "engaged_view",
                    "conversions":           round(ev, 4),
                    "conversions_value":     round(fx_value * w["evc"] * 0.6, 2),
                    "all_conversions":       round(ev, 4),
                    "all_conversions_value": round(fx_value * w["evc"] * 0.6, 2),
                    **meta,
                })
    return out


# ---------------------------------------------------------------------------
# Projector: Meta custom-API shape
# ---------------------------------------------------------------------------
def project_meta(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    df = latent.panel[latent.panel["channel"] == "meta_cpas"].reset_index(drop=True)
    if df.empty:
        return []
    out: list[dict] = []
    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        acct_id = account_id_for("meta_cpas", mk).replace("-", "_")
        meta = metadata(
            source_name="custom_meta_marketing_api", market=mk, accounts=[acct_id],
            window_start=cfg.start_date, window_end=cfg.end_date,
        )
        all_conv = int(r["all_conversions"])
        evc = int(r["evc_conversions"])
        click_conv = max(0, all_conv - evc)
        fx_value = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))
        # Split clicks 80% 7d_click / 20% 1d_click; views are 100% 1d_ev after
        # the Jan-2026 Meta change (no 7d_view / 28d_view allowed).
        splits = [
            ("7d_click", "purchase", int(click_conv * 0.8), fx_value * 0.8),
            ("1d_click", "purchase", int(click_conv * 0.2), fx_value * 0.2),
            ("1d_ev",    "purchase", evc,                    fx_value * 0.25),
        ]
        camp_id = f"cmp_{mk.lower()}_cpas_001"
        for attr_win, action, count, value in splits:
            if count == 0:
                continue
            out.append({
                "date":               d.isoformat(),
                "account_id":         acct_id,
                "campaign_id":        camp_id,
                "campaign_name":      "CPAS-ShopeePH-Always-On",
                "adset_id":           f"{camp_id}_as01",
                "attribution_window": attr_win,
                "action_type":        action,
                "action_count":       int(count),
                "action_value":       round(value, 2),
                **meta,
            })
    return out


# ---------------------------------------------------------------------------
# Projector: TikTok custom-API shape
# ---------------------------------------------------------------------------
def project_tiktok(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    df = latent.panel[latent.panel["channel"] == "tiktok_ads"].reset_index(drop=True)
    if df.empty:
        return []
    out: list[dict] = []
    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        adv_id = account_id_for("tiktok_ads", mk)
        meta = metadata(
            source_name="custom_tiktok_ads_api", market=mk, accounts=[adv_id],
            window_start=cfg.start_date, window_end=cfg.end_date,
        )
        all_conv = int(r["all_conversions"])
        evc = int(r["evc_conversions"])
        click_conv = max(0, all_conv - evc)
        # Split clicks between CTA (dominant) and VTA (view-through, small
        # residual — TikTok keeps a 1-day VTA signal separate from EVTA).
        cta = int(click_conv * 0.95)
        vta = max(0, click_conv - cta)
        fx_value = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))
        camp_id = f"tt_cmp_{mk.lower()}_01"
        ag_id = f"{camp_id}_ag01"
        splits = [
            ("CTA", 7, cta, fx_value * 0.80),
            ("VTA", 1, vta, fx_value * 0.05),
            ("EVTA", 7, evc, fx_value * 0.15),
        ]
        for attr_type, attr_win, count, value in splits:
            if count == 0:
                continue
            out.append({
                "date":                    d.isoformat(),
                "advertiser_id":           adv_id,
                "campaign_id":             camp_id,
                "adgroup_id":              ag_id,
                "attribution_type":        attr_type,
                "attribution_window_days": attr_win,
                "conversions":             int(count),
                "conversion_value":        round(value, 2),
                **meta,
            })
    return out


# ---------------------------------------------------------------------------
# Registry + pipeline entry points
# ---------------------------------------------------------------------------
EVC_REGISTRY = {
    "google": project_google,
    "meta":   project_meta,
    "tiktok": project_tiktok,
}


def derive_all_evc(latent: LatentState, cfg: SimConfig, rng: Rng,
                    platforms: Iterable[str] | None = None) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    selected = list(platforms) if platforms else list(EVC_REGISTRY.keys())
    for p in selected:
        if p not in EVC_REGISTRY:
            raise ValueError(f"unknown EVC platform: {p}")
        out[p] = EVC_REGISTRY[p](latent, cfg, rng.spawn(f"evc:{p}"))
    return out


def run_evc_pipeline(cfg: SimConfig, latent: LatentState, *,
                      platforms: list[str]) -> dict[str, int]:
    """Generate EVC rows and load directly to the raw_custom_apis dataset."""
    import click
    import os

    from ..bq import BQClient

    if not cfg.project:
        raise click.ClickException("--project (or GCP_PROJECT env) required")

    rng = make_rng(cfg.seed).spawn("evc_root")
    sets = derive_all_evc(latent, cfg, rng, platforms=platforms or None)

    bq = BQClient(project=cfg.project, location=os.environ.get("BQ_LOCATION", "asia-southeast1"))
    evc_dataset = os.environ.get("EVC_DATASET", "raw_custom_apis")

    table_map = {
        "google": f"{cfg.project}.{evc_dataset}.evc_google",
        "meta":   f"{cfg.project}.{evc_dataset}.evc_meta",
        "tiktok": f"{cfg.project}.{evc_dataset}.evc_tiktok",
    }
    counts: dict[str, int] = {}
    for p, rows in sets.items():
        if not rows:
            continue
        loaded = bq.load_json_rows(rows, table_map[p])
        counts[p] = loaded
        click.echo(f"  evc_{p:10s} {loaded:>10,} rows -> {table_map[p]}")
    return counts
