"""BigQuery helper — load JSON rows, run SQL, ensure datasets/tables exist."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from google.cloud import bigquery

from .logging_conf import get_logger

log = get_logger(__name__)


class BQClient:
    def __init__(self, project: str, location: str = "asia-southeast1"):
        self.project = project
        self.location = location
        self.client = bigquery.Client(project=project, location=location)

    # ---------- datasets / tables ----------
    def ensure_dataset(self, dataset_id: str) -> None:
        full = f"{self.project}.{dataset_id}"
        ds = bigquery.Dataset(full)
        ds.location = self.location
        self.client.create_dataset(ds, exists_ok=True)
        log.info("bq.dataset.ready", dataset=full)

    def run_ddl_file(self, sql_path: Path, substitutions: dict | None = None) -> None:
        sql = sql_path.read_text()
        if substitutions:
            for k, v in substitutions.items():
                sql = sql.replace(f"${{{k}}}", v)
        log.info("bq.run_ddl", file=str(sql_path))
        job = self.client.query(sql)
        job.result()

    def run_sql(self, sql: str, job_label: str | None = None) -> bigquery.job.QueryJob:
        job_config = bigquery.QueryJobConfig()
        if job_label:
            job_config.labels = {"job": job_label[:63].lower()}
        log.info("bq.run_sql", label=job_label, chars=len(sql))
        job = self.client.query(sql, job_config=job_config)
        job.result()
        return job

    # ---------- load ----------
    def load_json_rows(
        self,
        rows: Iterable[dict],
        table_fqn: str,
        *,
        write_disposition: str = bigquery.WriteDisposition.WRITE_APPEND,
        schema: list[bigquery.SchemaField] | None = None,
    ) -> int:
        """
        Load newline-delimited JSON rows into a table.
        Adds source_system and ingested_at if not present.
        Returns the count of rows loaded.
        """
        now = datetime.now(tz=timezone.utc).isoformat()
        buf = []
        for r in rows:
            r = dict(r)
            r.setdefault("ingested_at", now)
            buf.append(json.dumps(r, default=str))
        if not buf:
            log.info("bq.load.empty", table=table_fqn)
            return 0

        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            write_disposition=write_disposition,
            ignore_unknown_values=True,
            autodetect=schema is None,
            schema=schema,
        )
        data = ("\n".join(buf)).encode("utf-8")
        job = self.client.load_table_from_file(
            file_obj=_BytesIO(data),
            destination=table_fqn,
            job_config=job_config,
        )
        job.result()
        loaded = job.output_rows or len(buf)
        log.info("bq.load.done", table=table_fqn, rows=loaded)
        return loaded


def _BytesIO(data: bytes):
    """Avoid a top-level import of io for cleanliness."""
    import io

    return io.BytesIO(data)
