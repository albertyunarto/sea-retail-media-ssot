"""End-to-end orchestrator: config -> engine -> projections -> writers."""

from __future__ import annotations

import os
import time

import click

from ..bq import BQClient
from ..logging_conf import get_logger
from .config import SimConfig
from .engine import LatentState
from .projections import REGISTRY
from .rng import make_rng
from .writers import BigQueryWriter, CSVWriter, SupermetricsWriter

log = get_logger(__name__)

ALL_SOURCES: tuple[str, ...] = (
    "tiktok_shop",
    "tiktok_ads",
    "shopee_commerce",
    "shopee_ads",
    "meta_cpas",
    "google_ads_shopee",
)


def run_pipeline(cfg: SimConfig, latent: LatentState, *, dry_run: bool = False) -> dict[str, int]:
    """Project LatentState into the 6 Supermetrics-shaped row sets and persist
    them according to cfg.output_mode.

    Returns a dict {source_name: rows_written} so the CLI can print a summary.
    """
    sources = list(cfg.sources) if cfg.sources else list(ALL_SOURCES)
    unknown = set(sources) - set(ALL_SOURCES)
    if unknown:
        raise click.ClickException(f"Unknown sources requested: {sorted(unknown)}")

    rng = make_rng(cfg.seed).spawn("projections")
    counts: dict[str, int] = {}

    # Build row sets in-memory first so dry-run can report counts without writing.
    t_proj0 = time.time()
    row_sets: dict[str, list[dict]] = {}
    for src in sources:
        projector = REGISTRY[src]
        rs = projector(latent, cfg, rng.spawn(src))
        row_sets[src] = rs
        counts[src] = len(rs)
        log.info("sim.projected", source=src, rows=len(rs))
    click.echo(f"[sim] projection took {time.time()-t_proj0:.2f}s")

    if dry_run:
        click.echo("\n[dry-run] row counts per source (nothing written):")
        for src, n in counts.items():
            click.echo(f"  {src:20s} {n:>10,}")
        return counts

    # Persist
    writers: list = []
    if cfg.output_mode in ("supermetrics", "both"):
        if cfg.output_dir is None:
            raise click.ClickException("--output required when mode includes 'supermetrics'")
        writers.append(("supermetrics", SupermetricsWriter(cfg.output_dir)))
    if cfg.output_mode == "csv":
        if cfg.output_dir is None:
            raise click.ClickException("--output required when mode=csv")
        writers.append(("csv", CSVWriter(cfg.output_dir)))
    if cfg.output_mode in ("bq", "both"):
        if not cfg.project:
            raise click.ClickException("--project (or GCP_PROJECT env) required for mode=bq|both")
        bq = BQClient(project=cfg.project, location=os.environ.get("BQ_LOCATION", "asia-southeast1"))
        writers.append(("bq", BigQueryWriter(bq, cfg.project)))

    t_write0 = time.time()
    for writer_name, writer in writers:
        for src, rows in row_sets.items():
            written = writer.write_source(src, rows)
            log.info("sim.written", writer=writer_name, source=src, rows=written)
    click.echo(f"[sim] write took {time.time()-t_write0:.2f}s")

    click.echo("\n[sim] summary:")
    for src, n in counts.items():
        click.echo(f"  {src:20s} {n:>10,} rows")
    return counts


def run_evc_only(cfg: SimConfig, latent: LatentState, *, platforms: list[str]) -> dict[str, int]:
    """EVC-only pipeline (Phase 4). Defined here so the CLI's stub import resolves;
    the real logic lands in Phase 4."""
    from .evc import run_evc_pipeline

    return run_evc_pipeline(cfg, latent, platforms=platforms)
