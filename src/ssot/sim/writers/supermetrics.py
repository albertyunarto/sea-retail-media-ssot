"""Writes Supermetrics-shaped NDJSON to disk.

Layout: <root>/<source>/<market>/<YYYY-MM-DD>.ndjson
Each file contains the rows for that source on that day in that market, as
NDJSON (one JSON object per line). This matches what the real extractor
produces if you intercepted its per-call output before hitting BigQuery.

The `ingest` CLI command reads these files back and loads them via the same
`bq.load_json_rows` path the real extractors use — so the Supermetrics mode
and the direct-BQ mode produce identical raw tables.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path


class SupermetricsWriter:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def write_source(self, source_name: str, rows: list[dict]) -> int:
        """Partition rows by (market, date) and write one NDJSON file per bucket."""
        if not rows:
            return 0
        buckets: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for r in rows:
            mk = r.get("_market", "unknown")
            d = r.get("Date") or r.get("date") or "unknown"
            if isinstance(d, date):
                d = d.isoformat()
            buckets[(mk, str(d))].append(r)

        total = 0
        for (mk, d), bucket_rows in buckets.items():
            out_dir = self.root / source_name / mk
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{d}.ndjson"
            with out_path.open("w") as f:
                for r in bucket_rows:
                    f.write(json.dumps(r, default=str))
                    f.write("\n")
            total += len(bucket_rows)
        return total
