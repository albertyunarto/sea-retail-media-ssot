"""Read Supermetrics-shaped NDJSON from disk -> load into raw BQ tables.

Directory layout expected (matches SupermetricsWriter output):
    <root>/<source>/<market>/<YYYY-MM-DD>.ndjson

For each source, concatenates all files and loads via the existing
`BQClient.load_json_rows` path. Symmetric with the real extractor's final
load step.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import click

from ..bq import BQClient
from ..config import load_sources
from ..logging_conf import get_logger

log = get_logger(__name__)


def _iter_source_rows(source_dir: Path) -> list[dict]:
    rows: list[dict] = []
    for ndjson in sorted(source_dir.rglob("*.ndjson")):
        with ndjson.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rows.append(json.loads(line))
    return rows


def ingest_directory(root: Path, *, project: str) -> dict[str, int]:
    root = Path(root)
    if not root.exists():
        raise click.ClickException(f"input directory not found: {root}")

    bq = BQClient(project=project, location=os.environ.get("BQ_LOCATION", "asia-southeast1"))
    sources = load_sources().sources
    counts: dict[str, int] = {}

    for src_name, src_cfg in sources.items():
        src_dir = root / src_name
        if not src_dir.exists():
            log.info("ingest.skip.missing_source_dir", source=src_name, dir=str(src_dir))
            continue
        rows = _iter_source_rows(src_dir)
        if not rows:
            log.info("ingest.skip.no_rows", source=src_name)
            continue
        table_fqn = src_cfg.raw_table.replace("${GCP_PROJECT}", project)
        loaded = bq.load_json_rows(rows, table_fqn)
        counts[src_name] = loaded
        click.echo(f"  {src_name:20s} {loaded:>10,} rows -> {table_fqn}")
    return counts
