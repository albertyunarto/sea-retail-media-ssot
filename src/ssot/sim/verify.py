"""Runs the 10 invariant SQLs under sql/verify/ and prints pass/fail.

Each file should return ZERO rows on pass; any returned row is a violation.
Exit code: 0 if all pass, 1 otherwise.
"""

from __future__ import annotations

import os
from pathlib import Path

import click

from ..bq import BQClient
from ..logging_conf import get_logger
from ..transform import _substitutions

log = get_logger(__name__)

VERIFY_DIR = Path(__file__).resolve().parents[3] / "sql" / "verify"


def run_verify(*, project: str, verbose: bool = False) -> int:
    os.environ.setdefault("GCP_PROJECT", project)
    bq = BQClient(project=project, location=os.environ.get("BQ_LOCATION", "asia-southeast1"))
    subs = _substitutions()

    files = sorted(VERIFY_DIR.glob("*.sql"))
    if not files:
        click.echo("no verify SQL files found under sql/verify/")
        return 1

    failures = 0
    click.echo(f"\n{'check':<55s} {'status':<8s} {'rows':>8s}")
    click.echo("-" * 72)
    for f in files:
        sql = f.read_text()
        for k, v in subs.items():
            sql = sql.replace(f"${{{k}}}", v)
        try:
            job = bq.run_sql(sql, job_label=f"verify_{f.stem}"[:63])
            rows = [dict(r) for r in job.result()]
            n = len(rows)
            if n == 0:
                status = "PASS"
            else:
                status = "FAIL"
                failures += 1
                if verbose:
                    click.echo(f"  violation sample: {rows[:3]}")
        except Exception as e:  # noqa: BLE001
            status = "ERROR"
            failures += 1
            n = -1
            if verbose:
                click.echo(f"  error: {e}")
        click.echo(f"{f.name:<55s} {status:<8s} {n:>8d}")

    click.echo("-" * 72)
    click.echo(f"{'total':<55s} {'FAIL' if failures else 'PASS':<8s} {failures:>8d}")
    return 0 if failures == 0 else 1
