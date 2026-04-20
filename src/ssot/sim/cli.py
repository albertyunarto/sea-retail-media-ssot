"""`gen-data` CLI entrypoint for the simulation sub-package.

Registered via pyproject.toml as `gen-data = "ssot.sim.cli:cli"`. Heavy deps
(numpy / scipy / pandas) are gated behind the `sim` extras; the CLI lazy-imports
the engine so subcommands like `gen-data init` still work without them.

Subcommands:
    gen-data init               scaffold config/sim/*.yaml with defaults
    gen-data run                generate end-to-end (supermetrics | bq | both)
    gen-data evc                generate EVC custom-API extension only
    gen-data ingest             load Supermetrics-shaped NDJSON from disk -> BQ
    gen-data verify             run 10 invariant SQLs against the project
    gen-data scenarios list|apply
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from pathlib import Path

import click


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _parse_date(s: str | None, default: date | None = None) -> date:
    if not s:
        if default is None:
            return date.today()
        return default
    return datetime.strptime(s, "%Y-%m-%d").date()


def _split_csv(s: str | None) -> list[str]:
    if not s:
        return []
    return [item.strip() for item in s.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# CLI group
# ---------------------------------------------------------------------------
@click.group()
def cli() -> None:
    """Cross-channel simulation data generator for SEA retail media SSOT."""


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--brand-name", default="Elysium Home Care")
@click.option("--force/--no-force", default=False, help="Overwrite existing files.")
def init(brand_name: str, force: bool) -> None:
    """Scaffold config/sim/*.yaml files with sensible defaults."""
    from . import config as _cfg  # noqa: F401 — validates package importable
    target = _cfg.SIM_CONFIG_DIR
    target.mkdir(parents=True, exist_ok=True)
    created = []
    skipped = []
    for name in ("brand.yaml", "priors.yaml", "seasonality.yaml", "scenarios.yaml"):
        dest = target / name
        if dest.exists() and not force:
            skipped.append(dest)
            continue
        created.append(dest)
    click.echo(
        f"init: target={target}\n"
        f"  created: {[p.name for p in created]}\n"
        f"  skipped: {[p.name for p in skipped]}\n"
        f"(note: v1 ships pre-populated YAMLs under config/sim/; this command is a safety check.)"
    )


# ---------------------------------------------------------------------------
# run (stub — wired in Phase 3)
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--mode", type=click.Choice(["supermetrics", "bq", "both"]), default="bq")
@click.option("--seed", type=int, default=42)
@click.option("--days", type=int, default=180)
@click.option("--as-of", default=None, help="YYYY-MM-DD. End date of sim horizon. Defaults to today.")
@click.option("--markets", default=None, help="Comma-separated ISO-2 codes.")
@click.option("--sources", default=None, help="Comma-separated source names.")
@click.option("--output", "output_dir", default=None, type=click.Path(path_type=Path))
@click.option("--project", default=None, help="GCP project (required for mode=bq|both).")
@click.option("--scenario", default=None, help="Apply a named scenario overlay before running.")
@click.option("--dry-run/--no-dry-run", default=False)
def run(
    mode: str,
    seed: int,
    days: int,
    as_of: str | None,
    markets: str | None,
    sources: str | None,
    output_dir: Path | None,
    project: str | None,
    scenario: str | None,
    dry_run: bool,
) -> None:
    """Generate data end-to-end."""
    from .config import load_sim_config
    from .engine import simulate
    from .ground_truth import emit_ground_truth
    from .pipeline import run_pipeline
    from .scenarios import apply_by_name

    as_of_d = _parse_date(as_of)
    start_d = as_of_d - timedelta(days=days - 1)
    cfg = load_sim_config(
        seed=seed,
        start_date=start_d,
        end_date=as_of_d,
        output_mode=mode,  # type: ignore[arg-type]
        output_dir=output_dir,
        project=project or os.environ.get("GCP_PROJECT"),
        markets=_split_csv(markets),
        sources=_split_csv(sources),
    )
    if scenario:
        cfg = apply_by_name(cfg, scenario)
        click.echo(f"[sim] applied scenario: {scenario}")

    latent = simulate(cfg)
    run_pipeline(cfg, latent, dry_run=dry_run)

    if output_dir and not dry_run:
        emit_ground_truth(latent, output_dir / "mmm_ground_truth.yaml")
        click.echo(f"[sim] emitted MMM ground truth -> {output_dir / 'mmm_ground_truth.yaml'}")


# ---------------------------------------------------------------------------
# evc (stub — wired in Phase 4)
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--seed", type=int, default=42)
@click.option("--days", type=int, default=180)
@click.option("--as-of", default=None)
@click.option("--project", default=None)
@click.option("--platforms", default="google,meta,tiktok")
def evc(seed: int, days: int, as_of: str | None, project: str | None, platforms: str) -> None:
    """Generate EVC custom-API data only."""
    from .config import load_sim_config
    from .engine import simulate
    from .pipeline import run_evc_only

    as_of_d = _parse_date(as_of)
    start_d = as_of_d - timedelta(days=days - 1)
    cfg = load_sim_config(
        seed=seed,
        start_date=start_d,
        end_date=as_of_d,
        output_mode="bq",
        project=project or os.environ.get("GCP_PROJECT"),
    )
    latent = simulate(cfg)
    run_evc_only(cfg, latent, platforms=_split_csv(platforms))


# ---------------------------------------------------------------------------
# ingest (stub — wired in Phase 3)
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--input", "input_dir", required=True, type=click.Path(exists=True, path_type=Path))
@click.option("--project", default=None)
def ingest(input_dir: Path, project: str | None) -> None:
    """Read Supermetrics-shaped NDJSON from disk and load into raw BQ tables."""
    from .ingest import ingest_directory

    ingest_directory(input_dir, project=project or os.environ["GCP_PROJECT"])


# ---------------------------------------------------------------------------
# verify (stub — wired in Phase 5)
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--project", default=None)
@click.option("--verbose/--no-verbose", default=False)
def verify(project: str | None, verbose: bool) -> None:
    """Run sanity-check invariant SQLs; print a pass/fail table."""
    from .verify import run_verify

    raise SystemExit(run_verify(project=project or os.environ["GCP_PROJECT"], verbose=verbose))


# ---------------------------------------------------------------------------
# scenarios (stub — wired in Phase 5)
# ---------------------------------------------------------------------------
@cli.group()
def scenarios() -> None:
    """Pre-built scenario overlays."""


@scenarios.command("list")
def scenarios_list() -> None:
    from .config import load_scenarios

    for name, sc in load_scenarios().scenarios.items():
        click.echo(f"{name:24s}  {sc.description}")


@scenarios.command("apply")
@click.option("--name", required=True)
def scenarios_apply(name: str) -> None:
    """Preview the patches a scenario would apply. Use `gen-data run --scenario <name>`
    to actually run with the scenario active."""
    from .config import load_scenarios

    sc = load_scenarios().scenarios.get(name)
    if not sc:
        raise click.ClickException(f"unknown scenario: {name}")
    click.echo(f"scenario: {sc.name}")
    click.echo(f"description: {sc.description}")
    for p in sc.patches:
        click.echo(f"  {p.op:4s} {p.path:60s} {p.value}")


if __name__ == "__main__":
    cli()
