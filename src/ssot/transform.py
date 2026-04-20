"""Run the staging → fact → mart SQL scripts in order.

All .sql files support simple ${VAR} substitution for:
  GCP_PROJECT, RAW_DATASET, STG_DATASET, FACT_DATASET, MART_DATASET, SEED_DATASET

This keeps the code stack-agnostic (no dbt dependency) while giving us
dbt-ish project-level substitutions.
"""

from __future__ import annotations

import os
from pathlib import Path

from .bq import BQClient
from .logging_conf import get_logger

log = get_logger(__name__)

SQL_ROOT = Path(__file__).resolve().parents[2] / "sql"

ORDER = [
    # seeds first (idempotent CREATE OR REPLACE)
    "seeds",
    # DDL for raw tables (safe to re-run; CREATE TABLE IF NOT EXISTS)
    "ddl",
    # staging views (CREATE OR REPLACE VIEW — no-op if upstream unchanged)
    "staging",
    # fact tables (MERGE)
    "fact",
    # mart (CREATE OR REPLACE TABLE)
    "mart",
    # EVC extension (custom-APIs): stg_evc + fact_evc + daily_channel_panel_evc.
    # Runs after mart because the EVC mart table reads daily_channel_panel.
    "evc",
]


def _substitutions() -> dict:
    return {
        "GCP_PROJECT": os.environ["GCP_PROJECT"],
        "RAW_DATASET": os.environ.get("RAW_DATASET", "raw_supermetrics"),
        "STG_DATASET": os.environ.get("STG_DATASET", "stg"),
        "FACT_DATASET": os.environ.get("FACT_DATASET", "fact"),
        "MART_DATASET": os.environ.get("MART_DATASET", "mart"),
        "SEED_DATASET": os.environ.get("SEED_DATASET", "seeds"),
        "EVC_DATASET": os.environ.get("EVC_DATASET", "raw_custom_apis"),
    }


def run_transforms(bq: BQClient, stages: list[str] | None = None) -> None:
    subs = _substitutions()
    for stage in ORDER:
        if stages and stage not in stages:
            continue
        folder = SQL_ROOT / stage
        if not folder.exists():
            continue
        for sql_file in sorted(folder.glob("*.sql")):
            log.info("transform.stage.file", stage=stage, file=sql_file.name)
            bq.run_ddl_file(sql_file, substitutions=subs)
