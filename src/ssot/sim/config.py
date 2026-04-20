"""Pydantic models + YAML loaders for the simulation sub-package.

The `config/sim/` directory holds four human-editable YAMLs that fully describe
a run:
    - brand.yaml         -> Brand, Category, SKU
    - priors.yaml        -> per-channel adstock/Hill/ROAS/funnel + EVC coverage
    - seasonality.yaml   -> DoW multipliers + named event windows per market
    - scenarios.yaml     -> named overlays (ConfigPatch lists)

The loaders mirror the root `ssot.config` pattern: YAML -> dict -> Pydantic
(validation + typing). `SimConfig` wraps them together alongside CLI-derived
fields (seed, start_date, end_date, output_mode).
"""

from __future__ import annotations

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, field_validator

SIM_CONFIG_DIR = Path(__file__).resolve().parents[3] / "config" / "sim"


# ---------------------------------------------------------------------------
# brand.yaml
# ---------------------------------------------------------------------------
Lifecycle = Literal["launch", "growth", "mature", "decline"]


class SKU(BaseModel):
    sku_id: str  # "ELY-LAU-0001"
    name: str
    category: str  # FK -> Category.id
    unit_price_sgd: float = Field(gt=0)
    margin_pct: float = Field(ge=0.0, le=1.0)
    lifecycle: Lifecycle = "mature"
    launch_day_offset: int = 0  # days after sim start; < 0 means already on shelf
    # optional per-market multipliers (applied on top of FX)
    market_price_multiplier: dict[str, float] = Field(default_factory=dict)


class Category(BaseModel):
    id: str  # "laundry"
    name: str
    base_demand_share: float = Field(ge=0.0, le=1.0)  # share of brand GMV
    skus: list[SKU] = Field(default_factory=list)


class Brand(BaseModel):
    name: str
    archetype: str = "home_care_personal_care"
    markets: list[str]  # ISO-2 market codes in play
    categories: list[Category]

    def skus_by_category(self) -> dict[str, list[SKU]]:
        return {c.id: c.skus for c in self.categories}

    def all_skus(self) -> list[SKU]:
        return [s for c in self.categories for s in c.skus]


class BrandFile(BaseModel):
    brand: Brand


# ---------------------------------------------------------------------------
# priors.yaml
# ---------------------------------------------------------------------------
class ChannelPrior(BaseModel):
    # Mandatory for paid channels
    adstock_halflife_days: float = Field(ge=0.5, le=30)
    hill_shape: float = Field(ge=1.0, le=3.0)
    baseline_roas: float = Field(gt=0)
    roas_band: tuple[float, float]
    cpm_sgd: float = Field(gt=0)
    ctr: float = Field(gt=0, le=1.0)
    cvr: float = Field(gt=0, le=1.0)

    # Shopee Ads only: fraction of gross spend funded by platform/seller vouchers
    voucher_subsidy_pct: float = Field(default=0.0, ge=0.0, le=1.0)

    # Ad-view signals: None = channel does not emit EVC (e.g. Shopee on-platform).
    # Otherwise: fraction of all_conversions that are view-assisted / engaged-view.
    evc_coverage_pct: float | None = Field(default=None, ge=0.0, le=1.0)

    # Daily spend pacing: mean SGD spend per day at the start of the horizon
    # (engine grows/decays this per DoW + seasonality).
    daily_spend_sgd_baseline: float = Field(gt=0)

    # Noise: coefficient on log-normal sigma (values) and negative-binomial
    # dispersion (counts). Smaller => cleaner; larger => more realistic.
    noise_coef: float = Field(default=0.15, ge=0.0, le=1.0)

    @field_validator("roas_band")
    @classmethod
    def _roas_band_ordered(cls, v: tuple[float, float]) -> tuple[float, float]:
        if v[0] >= v[1]:
            raise ValueError("roas_band must be (low, high) with low < high")
        return v


class OrganicPrior(BaseModel):
    # Per-platform daily baseline GMV (SGD) for organic / non-ad traffic.
    baseline_daily_gmv_sgd: float = Field(gt=0)
    noise_coef: float = Field(default=0.2, ge=0.0, le=1.0)


class PriorsFile(BaseModel):
    channels: dict[str, ChannelPrior]
    organic: dict[str, OrganicPrior]  # "shopee", "tiktok_shop"


# ---------------------------------------------------------------------------
# seasonality.yaml
# ---------------------------------------------------------------------------
EventKind = Literal["payday", "festival", "ramadan", "mega_sale", "custom"]


class EventWindow(BaseModel):
    name: str
    kind: EventKind
    markets: list[str] = Field(default_factory=list)  # empty = all markets
    start: date
    end: date
    uplift_mult: float = Field(gt=0)  # multiplicative on base demand
    # If set, restricts the overlay to just these channel keys (default = all).
    channels: list[str] = Field(default_factory=list)

    @field_validator("end")
    @classmethod
    def _end_after_start(cls, v: date, info) -> date:
        start = info.data.get("start")
        if start and v < start:
            raise ValueError(f"event end ({v}) before start ({start})")
        return v


class SeasonalityFile(BaseModel):
    # Day-of-week multiplier: keys are Mon..Sun
    dow_multiplier: dict[str, float] = Field(
        default_factory=lambda: {
            "Mon": 0.95,
            "Tue": 0.9,
            "Wed": 0.9,
            "Thu": 0.95,
            "Fri": 1.05,
            "Sat": 1.15,
            "Sun": 1.10,
        }
    )
    # Payday days-of-month (applied every month unless overridden by event)
    payday_days: list[int] = Field(default_factory=lambda: [1, 15, 16])
    payday_uplift: float = 1.25

    events: list[EventWindow] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# scenarios.yaml
# ---------------------------------------------------------------------------
class ConfigPatch(BaseModel):
    # Dotted path relative to SimConfig, e.g.
    # "priors.channels.tiktok_ads.baseline_roas"
    path: str
    op: Literal["set", "mul", "add"]
    value: float | str | int | bool | None


class Scenario(BaseModel):
    name: str
    description: str = ""
    patches: list[ConfigPatch] = Field(default_factory=list)


class ScenariosFile(BaseModel):
    scenarios: dict[str, Scenario]


# ---------------------------------------------------------------------------
# Unified run config
# ---------------------------------------------------------------------------
OutputMode = Literal["supermetrics", "bq", "both"]


class SimConfig(BaseModel):
    seed: int = 42
    start_date: date
    end_date: date
    output_mode: OutputMode = "bq"
    output_dir: Path | None = None
    project: str | None = None  # GCP project for BQ mode

    brand: Brand
    priors: PriorsFile
    seasonality: SeasonalityFile
    scenarios: ScenariosFile = ScenariosFile(scenarios={})

    # Restrict the run (default = everything)
    markets: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)

    @field_validator("end_date")
    @classmethod
    def _dates_ordered(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError(f"end_date ({v}) before start_date ({start})")
        return v

    def effective_markets(self) -> list[str]:
        return self.markets or list(self.brand.markets)


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------
def _load_yaml(path: Path) -> dict:
    with path.open() as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=1)
def load_brand(config_dir: Path = SIM_CONFIG_DIR) -> Brand:
    return BrandFile(**_load_yaml(config_dir / "brand.yaml")).brand


@lru_cache(maxsize=1)
def load_priors(config_dir: Path = SIM_CONFIG_DIR) -> PriorsFile:
    return PriorsFile(**_load_yaml(config_dir / "priors.yaml"))


@lru_cache(maxsize=1)
def load_seasonality(config_dir: Path = SIM_CONFIG_DIR) -> SeasonalityFile:
    return SeasonalityFile(**_load_yaml(config_dir / "seasonality.yaml"))


@lru_cache(maxsize=1)
def load_scenarios(config_dir: Path = SIM_CONFIG_DIR) -> ScenariosFile:
    path = config_dir / "scenarios.yaml"
    if not path.exists():
        return ScenariosFile(scenarios={})
    return ScenariosFile(**_load_yaml(path))


def load_sim_config(
    *,
    seed: int,
    start_date: date,
    end_date: date,
    output_mode: OutputMode = "bq",
    output_dir: Path | None = None,
    project: str | None = None,
    markets: list[str] | None = None,
    sources: list[str] | None = None,
    config_dir: Path = SIM_CONFIG_DIR,
) -> SimConfig:
    """Build a SimConfig by loading the four YAMLs and overlaying CLI args."""
    return SimConfig(
        seed=seed,
        start_date=start_date,
        end_date=end_date,
        output_mode=output_mode,
        output_dir=output_dir,
        project=project,
        brand=load_brand(config_dir),
        priors=load_priors(config_dir),
        seasonality=load_seasonality(config_dir),
        scenarios=load_scenarios(config_dir),
        markets=markets or [],
        sources=sources or [],
    )
