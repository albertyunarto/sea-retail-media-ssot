"""Writes Supermetrics-shaped rows as flat CSV files on disk.

Layout: `<root>/<source>.csv` — one file per connector, all markets and
all days concatenated. Columns follow the field list declared in
`config/sources.yaml` (so the output is shape-equivalent to what the
real Supermetrics extractor would return), plus the enrichment block
(`_source_system`, `_market`, `_accounts`, `_window_start`,
`_window_end`) stamped by the projections.

This is the handoff format for users who want to import the simulated
data into Supermetrics (or Google Sheets, Drive, Excel) without running
the BigQuery ingest path.
"""

from __future__ import annotations

import csv
from collections import OrderedDict
from datetime import date, datetime
from pathlib import Path

from ...config import load_sources


class CSVWriter:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self._sources = load_sources().sources

    def write_source(self, source_name: str, rows: list[dict]) -> int:
        if not rows:
            return 0

        # Column order: Supermetrics fields (from config/sources.yaml) first,
        # then the enrichment metadata. Keeps the CSV's left-hand side
        # matching the connector's native shape.
        src_cfg = self._sources.get(source_name)
        declared_fields = list(src_cfg.fields) if src_cfg else []
        meta_fields = [
            "_source_system",
            "_market",
            "_accounts",
            "_window_start",
            "_window_end",
        ]

        # Capture any additional columns emitted by the projector that
        # aren't in the declared field list (shouldn't happen, but
        # defensive — don't silently drop them).
        seen = OrderedDict()
        for f in declared_fields:
            seen[f] = None
        for f in meta_fields:
            seen[f] = None
        for r in rows:
            for k in r.keys():
                if k not in seen:
                    seen[k] = None

        columns = list(seen.keys())
        out_path = self.root / f"{source_name}.csv"
        with out_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(columns)
            for r in rows:
                w.writerow([_coerce(r.get(c)) for c in columns])
        return len(rows)


def _coerce(v) -> str:
    """Make a cell safe for CSV — dates as ISO strings, None as empty."""
    if v is None:
        return ""
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)
