"""CLI entrypoint.

Invoked by Cloud Run Job (see Dockerfile CMD). Subcommands:

  ssot extract --source tiktok_ads [--market ID] [--as-of 2026-04-18]
  ssot extract-all [--as-of 2026-04-18]
  ssot transform [--stage staging,fact,mart]
  ssot run  # extract-all then transform
  ssot bootstrap  # create datasets + DDL (idempotent)
"""

from __future__ import annotations

import os
import sys
from datetime import date
from datetime import datetime as dt

import click

from .bq import BQClient
from .config import load_sources
from .extractors import REGISTRY
from .logging_conf import get_logger, setup_logging
from .secrets import get_secret
from .supermetrics import SupermetricsClient
from .transform import run_transforms

setup_logging()
log = get_logger(__name__)


def _clients() -> tuple[SupermetricsClient, BQClient]:
    project = os.environ["GCP_PROJECT"]
    location = os.environ.get("BQ_LOCATION", "asia-southeast1")
    api_key = get_secret("SUPERMETRICS_API_KEY")
    team_id = os.environ.get("SUPERMETRICS_TEAM_ID")
    return (
        SupermetricsClient(api_key=api_key, team_id=team_id),
        BQClient(project=project, location=location),
    )


def _parse_as_of(s: str | None) -> date:
    if not s:
        return date.today()
    return dt.strptime(s, "%Y-%m-%d").date()


@click.group()
def cli() -> None:
    """SEA Retail Media SSOT — Supermetrics → BigQuery ELT."""


@cli.command()
@click.option("--source", required=True, help="Source name (e.g. tiktok_ads).")
@click.option("--market", default=None, help="ISO-2 market (optional filter).")
@click.option("--as-of", default=None, help="YYYY-MM-DD. Defaults to today.")
def extract(source: str, market: str | None, as_of: str | None) -> None:
    sm, bq = _clients()
    src_cfg = load_sources().sources.get(source)
    if not src_cfg:
        raise click.ClickException(f"Unknown source: {source}")
    fn = REGISTRY.get(source)
    if not fn:
        raise click.ClickException(f"No extractor registered for: {source}")
    rows = fn(src_cfg, sm, bq, as_of=_parse_as_of(as_of), market=market)
    log.info("extract.done", source=source, rows=rows)


@cli.command("extract-all")
@click.option("--as-of", default=None)
def extract_all(as_of: str | None) -> None:
    sm, bq = _clients()
    sources = load_sources().sources
    as_of_d = _parse_as_of(as_of)
    errs: list[tuple[str, Exception]] = []
    for name, cfg in sources.items():
        try:
            fn = REGISTRY[name]
            fn(cfg, sm, bq, as_of=as_of_d)
        except Exception as e:  # noqa: BLE001
            log.error("extract.error", source=name, error=str(e))
            errs.append((name, e))
    if errs:
        msg = "; ".join(f"{n}: {e}" for n, e in errs)
        raise click.ClickException(f"{len(errs)} source(s) failed — {msg}")


@cli.command()
@click.option(
    "--stage",
    default=None,
    help="Comma-sep list of stages (seeds,ddl,staging,fact,mart). "
    "Default: run everything except seeds/ddl.",
)
def transform(stage: str | None) -> None:
    _, bq = _clients()
    stages = stage.split(",") if stage else ["staging", "fact", "mart"]
    run_transforms(bq, stages=stages)


@cli.command()
def bootstrap() -> None:
    """Create datasets and run seed + DDL (idempotent). Run once per env."""
    _, bq = _clients()
    for ds in ("RAW_DATASET", "STG_DATASET", "FACT_DATASET", "MART_DATASET", "SEED_DATASET"):
        name = os.environ.get(ds, {
            "RAW_DATASET": "raw_supermetrics",
            "STG_DATASET": "stg",
            "FACT_DATASET": "fact",
            "MART_DATASET": "mart",
            "SEED_DATASET": "seeds",
        }[ds])
        bq.ensure_dataset(name)
    run_transforms(bq, stages=["seeds", "ddl"])


@cli.command()
@click.option("--as-of", default=None)
def run(as_of: str | None) -> None:
    """Full pipeline: extract-all + transform."""
    sm, bq = _clients()
    as_of_d = _parse_as_of(as_of)
    sources = load_sources().sources
    errs = []
    for name, cfg in sources.items():
        try:
            REGISTRY[name](cfg, sm, bq, as_of=as_of_d)
        except Exception as e:  # noqa: BLE001
            log.error("extract.error", source=name, error=str(e))
            errs.append((name, e))
    run_transforms(bq, stages=["staging", "fact", "mart"])
    if errs:
        msg = "; ".join(f"{n}: {e}" for n, e in errs)
        log.error("run.partial_failure", detail=msg)
        sys.exit(2)  # partial failure — alert but transforms still ran


if __name__ == "__main__":
    cli()
