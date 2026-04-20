"""Direct-to-BigQuery writer — wraps BQClient.load_json_rows."""

from __future__ import annotations

from ...bq import BQClient
from ...config import load_sources


class BigQueryWriter:
    def __init__(self, bq: BQClient, project: str):
        self.bq = bq
        self.project = project
        self.sources = load_sources().sources

    def write_source(self, source_name: str, rows: list[dict]) -> int:
        if not rows:
            return 0
        src = self.sources.get(source_name)
        if src is None:
            raise KeyError(f"Unknown source: {source_name} (not in config/sources.yaml)")
        table_fqn = src.raw_table.replace("${GCP_PROJECT}", self.project)
        return self.bq.load_json_rows(rows, table_fqn)
