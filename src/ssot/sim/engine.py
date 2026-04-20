"""Core simulation engine: produces a LatentState DataFrame.

Flow:
    1. Build skeleton grid (market × date × channel) across the config horizon.
    2. Draw baseline daily spend per (market, channel), modulated by the
       market's seasonality multiplier (DoW × payday × events).
    3. Apply adstock + Hill per channel to map spend -> attributable revenue.
    4. Draw the funnel (impressions -> clicks -> ad-attributed orders) from
       cpm / ctr / cvr priors with multiplicative lognormal noise.
    5. Draw organic (non-ads) platform GMV per (market, date, platform).
    6. Derive EVC (view-assisted fraction of all_conversions) via Binomial
       on conversions so the invariant `evc <= all_conversions` holds exactly.
    7. Enforce `SUM(ads_attributed_gmv_sgd) <= 0.95 * platform_total_gmv_sgd`
       per (market, date, anchor_platform) by clipping downward.
    8. Return the LatentState frame; projections take it from here.

The result is a tidy pandas DataFrame, indexed per row by (market, date_local,
channel), with all per-day totals in SGD (FX is applied at the projection
layer for local currencies).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd

from .calendar import daterange, num_days
from .config import ChannelPrior, PriorsFile, SimConfig
from .noise import jitter_count, jitter_value
from .response import calibrated_response
from .rng import Rng, make_rng
from .seasonality import build_multiplier_map

# Anchor platform per channel (matches taxonomy.yaml + staging views).
CHANNEL_ANCHOR_PLATFORM: dict[str, str] = {
    "shopee_ads_product_search": "shopee",
    "shopee_ads_shop_search":    "shopee",
    "shopee_ads_targeting":      "shopee",
    "shopee_ads_gmv_max":        "shopee",
    "shopee_ads_affiliate":      "shopee",
    "tiktok_ads":                "tiktok_shop",
    "meta_cpas":                 "shopee",
    "google_ads_shopee":         "shopee",
}

# The "platform" value that goes into the SSOT's stg/fact tables.
CHANNEL_STG_PLATFORM: dict[str, str] = {
    "shopee_ads_product_search": "shopee_ads",
    "shopee_ads_shop_search":    "shopee_ads",
    "shopee_ads_targeting":      "shopee_ads",
    "shopee_ads_gmv_max":        "shopee_ads",
    "shopee_ads_affiliate":      "shopee_ads",
    "tiktok_ads":                "tiktok_ads",
    "meta_cpas":                 "meta_cpas",
    "google_ads_shopee":         "google_ads_shopee",
}


@dataclass
class LatentState:
    """Ground-truth frame that projectors read.

    `panel` — row per (market, date_local, channel) for paid channels:
        columns: platform, anchor_platform, spend_sgd, voucher_subsidy_sgd,
                 impressions, clicks, ads_attributed_orders,
                 ads_attributed_gmv_sgd, all_conversions, evc_conversions,
                 conversion_value_sgd

    `organic` — row per (market, date_local, anchor_platform) for non-ads GMV:
        columns: platform_total_gmv_sgd, orders

    `platform_totals` — convenience roll-up (same grain as `organic`) including
    both ads_attributed_gmv + organic_gmv after the invariant clip.
    """

    panel: pd.DataFrame
    organic: pd.DataFrame
    platform_totals: pd.DataFrame
    # Retained for MMM ground-truth emission in Phase 5.
    ground_truth: dict[str, dict]


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------
def simulate(cfg: SimConfig) -> LatentState:
    rng = make_rng(cfg.seed)
    markets = cfg.effective_markets()
    dates = list(daterange(cfg.start_date, cfg.end_date))
    n_days = len(dates)

    seas_map = build_multiplier_map(cfg.seasonality, markets, cfg.start_date, cfg.end_date)

    # ----- Paid channels: per-channel simulation -----
    panel_rows: list[pd.DataFrame] = []
    ground_truth: dict[str, dict] = {}
    for channel_name, prior in cfg.priors.channels.items():
        ch_frame = _simulate_channel(
            channel=channel_name,
            prior=prior,
            markets=markets,
            dates=dates,
            seas_map=seas_map,
            rng=rng.spawn(f"channel:{channel_name}"),
        )
        panel_rows.append(ch_frame)
        ground_truth[channel_name] = {
            "adstock_halflife_days": prior.adstock_halflife_days,
            "hill_shape": prior.hill_shape,
            "baseline_roas": prior.baseline_roas,
            "daily_spend_sgd_baseline": prior.daily_spend_sgd_baseline,
            "evc_coverage_pct": prior.evc_coverage_pct,
        }

    panel = pd.concat(panel_rows, ignore_index=True)

    # ----- Organic platform totals -----
    organic = _simulate_organic(
        priors=cfg.priors,
        markets=markets,
        dates=dates,
        seas_map=seas_map,
        rng=rng.spawn("organic"),
    )

    # ----- Invariant: ads_attributed_gmv <= 0.95 * platform_total_gmv -----
    panel, organic, platform_totals = _enforce_gmv_invariant(panel, organic)

    return LatentState(
        panel=panel,
        organic=organic,
        platform_totals=platform_totals,
        ground_truth=ground_truth,
    )


# --------------------------------------------------------------------------
# Per-channel simulation
# --------------------------------------------------------------------------
def _simulate_channel(
    *,
    channel: str,
    prior: ChannelPrior,
    markets: list[str],
    dates: list[date],
    seas_map: dict[tuple[str, date], float],
    rng: Rng,
) -> pd.DataFrame:
    """Produce the per-(market, date) rows for one paid channel."""
    n_days = len(dates)
    frames: list[pd.DataFrame] = []

    # A slow-moving market-level spend multiplier (markets aren't identical size).
    market_scale_rng = rng.spawn("market_scale")
    market_scale = {
        mk: float(market_scale_rng.lognormal(mean=0.0, sigma=0.25))
        for mk in markets
    }

    for mk in markets:
        mk_rng = rng.spawn(f"market:{mk}")
        # Daily seasonality multiplier for this market.
        mult = np.array([seas_map[(mk, d)] for d in dates], dtype=float)

        # Base daily spend = baseline * market_scale * seasonality * lognormal noise.
        base = prior.daily_spend_sgd_baseline * market_scale[mk] * mult
        spend = jitter_value(mk_rng.spawn("spend"), base, prior.noise_coef * 0.8)
        spend = np.clip(spend, a_min=0.0, a_max=None)

        # Attributable revenue via adstock + Hill response curve, calibrated so
        # that steady-state ROAS ~ baseline_roas. Demand-side seasonality is
        # already baked into spend (which is multiplied by `mult`), so a
        # *mild* extra revenue tilt is enough to keep aggregates near baseline.
        revenue = calibrated_response(
            spend,
            halflife_days=prior.adstock_halflife_days,
            hill_shape=prior.hill_shape,
            baseline_roas=prior.baseline_roas,
            daily_baseline_spend_sgd=prior.daily_spend_sgd_baseline * market_scale[mk],
        )
        revenue = jitter_value(mk_rng.spawn("revenue"), revenue, prior.noise_coef)
        revenue = np.clip(revenue, a_min=0.0, a_max=None)

        # Funnel: impressions -> clicks -> orders from spend & priors.
        # impressions = spend_sgd / cpm * 1000  (with noise)
        impressions_mean = np.where(prior.cpm_sgd > 0, spend / prior.cpm_sgd * 1000.0, 0.0)
        impressions = jitter_count(mk_rng.spawn("impressions"), impressions_mean, overdispersion=0.05)

        clicks_mean = impressions.astype(float) * prior.ctr
        clicks = jitter_count(mk_rng.spawn("clicks"), clicks_mean, overdispersion=0.08)
        clicks = np.minimum(clicks, impressions)  # funnel monotonicity

        orders_mean = clicks.astype(float) * prior.cvr
        orders = jitter_count(mk_rng.spawn("orders"), orders_mean, overdispersion=0.12)
        orders = np.minimum(orders, clicks)

        # Total conversions = attributed orders (click-based). all_conversions
        # layers in view-assisted + engaged-view contributions and is always
        # >= orders (so EVC bounded by all_conversions is bounded by definition).
        # For channels without EVC, all_conversions == orders.
        if prior.evc_coverage_pct is None:
            all_conversions = orders.astype(float)
            evc_conversions = np.zeros_like(orders, dtype=float)
        else:
            # EVC is a multiplicative lift on top of click-based orders.
            # Draw evc_lift ~ Binomial-derived so evc <= all_conversions strictly.
            coverage = float(prior.evc_coverage_pct)
            # Expected all_conversions = orders / (1 - coverage); EVC contributes
            # `coverage` of the all_conversions total. Draw n so we stay integer.
            # Sample an uplift factor in [1, 1 / (1 - coverage)] deterministically.
            uplift_target = 1.0 / max(1e-6, 1.0 - coverage)
            # Mean uplift stochasticity via lognormal (sigma=0.1).
            uplift = uplift_target * np.exp(
                mk_rng.spawn("evc_lift").normal(loc=-0.005, scale=0.1, size=orders.shape)
            )
            uplift = np.clip(uplift, 1.0, None)
            all_conv_mean = orders.astype(float) * uplift
            all_conversions = np.round(all_conv_mean).astype(np.int64)
            # EVC is the view-assisted slice: Binomial(n=all, p=coverage).
            # By construction evc <= all_conversions.
            evc_rng = mk_rng.spawn("evc")
            evc_conversions = evc_rng.binomial(
                n=all_conversions.astype(np.int64), p=coverage
            ).astype(np.int64)

        # Conversion value: revenue is our attributable GMV.
        conversion_value = revenue

        # Voucher subsidy (Shopee only). Peaks during mega-sales (seasonality
        # mult-scaled around baseline pct, clipped to [0, 0.45]).
        voucher_subsidy = np.zeros_like(spend)
        if prior.voucher_subsidy_pct > 0:
            sub_pct = np.clip(
                prior.voucher_subsidy_pct * (0.7 + 0.3 * mult / mult.mean())
                * (1.0 + 0.3 * (mult > 1.8).astype(float)),  # extra push on mega-sales
                0.0, 0.45,
            )
            voucher_subsidy = spend * sub_pct

        frames.append(pd.DataFrame({
            "market":                  mk,
            "date_local":              dates,
            "channel":                 channel,
            "platform":                CHANNEL_STG_PLATFORM[channel],
            "anchor_platform":         CHANNEL_ANCHOR_PLATFORM[channel],
            "spend_sgd":               spend,
            "voucher_subsidy_sgd":     voucher_subsidy,
            "impressions":             impressions.astype(np.int64),
            "clicks":                  clicks.astype(np.int64),
            "ads_attributed_orders":   orders.astype(np.int64),
            "ads_attributed_gmv_sgd":  revenue,
            "all_conversions":         all_conversions.astype(np.float64),
            "evc_conversions":         evc_conversions.astype(np.float64),
            "conversion_value_sgd":    conversion_value,
        }))

    return pd.concat(frames, ignore_index=True)


# --------------------------------------------------------------------------
# Organic / non-ads platform GMV
# --------------------------------------------------------------------------
def _simulate_organic(
    *,
    priors: PriorsFile,
    markets: list[str],
    dates: list[date],
    seas_map: dict[tuple[str, date], float],
    rng: Rng,
) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    # Per-market scale (different market sizes).
    ms_rng = rng.spawn("market_scale")
    market_scale = {mk: float(ms_rng.lognormal(mean=0.0, sigma=0.30)) for mk in markets}

    for platform, oprior in priors.organic.items():
        for mk in markets:
            mk_rng = rng.spawn(f"{platform}:{mk}")
            mult = np.array([seas_map[(mk, d)] for d in dates], dtype=float)
            base = oprior.baseline_daily_gmv_sgd * market_scale[mk] * mult
            gmv = jitter_value(mk_rng.spawn("gmv"), base, oprior.noise_coef)
            gmv = np.clip(gmv, a_min=0.0, a_max=None)

            # AOV rough estimate for orders derivation; SGD 40 per order
            # (SEA CPG basket of 2-3 items). Orders = gmv / AOV with noise.
            aov_sgd = 40.0
            orders_mean = gmv / aov_sgd
            orders = jitter_count(mk_rng.spawn("orders"), orders_mean, overdispersion=0.1)

            frames.append(pd.DataFrame({
                "market":                   mk,
                "date_local":               dates,
                "anchor_platform":          platform,
                "platform_total_gmv_sgd":   gmv,
                "platform_total_orders":    orders.astype(np.int64),
            }))
    return pd.concat(frames, ignore_index=True)


# --------------------------------------------------------------------------
# Invariant enforcement
# --------------------------------------------------------------------------
def _enforce_gmv_invariant(panel: pd.DataFrame, organic: pd.DataFrame):
    """Clip ads_attributed_gmv so SUM(ads) <= 0.95 * platform_total_gmv.

    Ensures the staging/mart assertion `SUM(ads_attributed_gmv_usd) <=
    platform_total_gmv_usd within 5%` passes. Adjusts ads downward (not
    organic upward) so order volumes track realistic daily AOV * demand.

    Returns (panel, organic, platform_totals) where platform_totals is the
    final (market, date, anchor_platform) roll-up including both streams.
    """
    # Sum ads per (market, date, anchor_platform).
    ads_sum = (
        panel.groupby(["market", "date_local", "anchor_platform"], as_index=False)
        ["ads_attributed_gmv_sgd"].sum()
        .rename(columns={"ads_attributed_gmv_sgd": "ads_total_sgd"})
    )

    merged = organic.merge(ads_sum, on=["market", "date_local", "anchor_platform"], how="left")
    merged["ads_total_sgd"] = merged["ads_total_sgd"].fillna(0.0)
    # Clip factor: if ads exceed 95% of organic platform_total_gmv, scale them down.
    max_allowed = merged["platform_total_gmv_sgd"] * 0.95
    clip = np.where(
        merged["ads_total_sgd"] > max_allowed,
        max_allowed / merged["ads_total_sgd"].replace(0, np.nan),
        1.0,
    )
    merged["clip_factor"] = np.nan_to_num(clip, nan=1.0)
    merged["organic_gmv_sgd"] = (
        merged["platform_total_gmv_sgd"] - merged["ads_total_sgd"] * merged["clip_factor"]
    )

    # Apply the clip back to the panel (ads_attributed_gmv_sgd and conversion_value_sgd).
    panel = panel.merge(
        merged[["market", "date_local", "anchor_platform", "clip_factor"]],
        on=["market", "date_local", "anchor_platform"],
        how="left",
    )
    panel["clip_factor"] = panel["clip_factor"].fillna(1.0)
    panel["ads_attributed_gmv_sgd"] = panel["ads_attributed_gmv_sgd"] * panel["clip_factor"]
    panel["conversion_value_sgd"] = panel["conversion_value_sgd"] * panel["clip_factor"]
    panel.drop(columns=["clip_factor"], inplace=True)

    platform_totals = merged.drop(columns=["ads_total_sgd", "clip_factor"])

    # Update organic with the adjusted organic_gmv_sgd column.
    organic = organic.merge(
        platform_totals[["market", "date_local", "anchor_platform",
                         "platform_total_gmv_sgd", "organic_gmv_sgd"]],
        on=["market", "date_local", "anchor_platform"],
        how="left",
        suffixes=("_old", ""),
    ).drop(columns=["platform_total_gmv_sgd_old"])

    return panel, organic, platform_totals
