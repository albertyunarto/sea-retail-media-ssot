"""Supermetrics Enterprise API client.

Docs: https://supermetrics.com/docs/product-api-getting-started
Endpoint used: POST https://api.supermetrics.com/enterprise/v2/query/data

This client is intentionally thin. It:
  * builds a query payload from a SourceConfig + per-call overrides,
  * paginates via offset_start / offset_end if max_rows_per_call is hit,
  * retries on 429 / 5xx with exponential backoff,
  * returns a list[dict] (one dict per row, keyed by field name).

The caller (extractor) is responsible for chunking by account and by date window.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import date
from typing import Any

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .config import SourceConfig
from .logging_conf import get_logger

log = get_logger(__name__)

DEFAULT_ENDPOINT = "https://api.supermetrics.com/enterprise/v2/query/data"


class SupermetricsError(RuntimeError):
    """Raised on non-retryable Supermetrics API failures."""


class RetryableError(RuntimeError):
    """Raised on 429 / 5xx — caught by tenacity."""


@dataclass
class QueryWindow:
    start_date: date
    end_date: date


class SupermetricsClient:
    def __init__(
        self,
        api_key: str,
        team_id: str | None = None,
        endpoint: str = DEFAULT_ENDPOINT,
        session: requests.Session | None = None,
    ):
        self.api_key = api_key
        self.team_id = team_id
        self.endpoint = endpoint
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )
        if team_id:
            self.session.headers["X-Team-Id"] = team_id

    def query(
        self,
        source: SourceConfig,
        accounts: list[str],
        window: QueryWindow,
        extra_filters: list[dict] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Run a query, auto-paginating. Returns flat list of rows as dicts
        keyed by Supermetrics field names.
        """
        if not accounts:
            log.warning("supermetrics.query.empty_accounts", source=source.name)
            return []

        base_payload = self._build_payload(source, accounts, window, extra_filters)
        log.info(
            "supermetrics.query.start",
            source=source.name,
            ds_id=source.ds_id,
            accounts=len(accounts),
            start=str(window.start_date),
            end=str(window.end_date),
        )

        rows: list[dict[str, Any]] = []
        offset = 0
        page = 0
        while True:
            payload = dict(base_payload)
            payload["offset_start"] = offset
            payload["offset_end"] = offset + source.max_rows_per_call - 1
            data = self._post(payload, timeout=source.timeout_seconds)
            page_rows = self._rows_from_response(data)
            rows.extend(page_rows)
            log.info(
                "supermetrics.query.page",
                source=source.name,
                page=page,
                rows=len(page_rows),
                offset=offset,
            )
            if len(page_rows) < source.max_rows_per_call:
                break
            offset += source.max_rows_per_call
            page += 1
            time.sleep(0.25)  # gentle pacing between pages
        log.info(
            "supermetrics.query.done",
            source=source.name,
            total_rows=len(rows),
        )
        return rows

    # ------------------------------------------------------------------ #

    def _build_payload(
        self,
        source: SourceConfig,
        accounts: list[str],
        window: QueryWindow,
        extra_filters: list[dict] | None,
    ) -> dict:
        filters = list(source.filter_expressions or [])
        if extra_filters:
            filters.extend(extra_filters)
        payload: dict[str, Any] = {
            "ds_id": source.ds_id,
            "ds_accounts": accounts,
            "fields": source.fields,
            "date_range_type": "custom",
            "start_date": window.start_date.isoformat(),
            "end_date": window.end_date.isoformat(),
            "max_rows": source.max_rows_per_call,
            "format": "json",
        }
        if source.ds_user:
            payload["ds_user"] = source.ds_user
        if source.breakdowns:
            payload["breakdown_by"] = ",".join(source.breakdowns)
        if filters:
            payload["filter"] = filters
        return payload

    @retry(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=2, max=60),
        retry=retry_if_exception_type(RetryableError),
    )
    def _post(self, payload: dict, timeout: int) -> dict:
        resp = self.session.post(self.endpoint, json=payload, timeout=timeout)
        if resp.status_code in (429, 500, 502, 503, 504):
            log.warning(
                "supermetrics.retry",
                status=resp.status_code,
                body=resp.text[:500],
            )
            raise RetryableError(f"status={resp.status_code}")
        if resp.status_code >= 400:
            raise SupermetricsError(
                f"Supermetrics API error {resp.status_code}: {resp.text[:1000]}"
            )
        try:
            return resp.json()
        except json.JSONDecodeError as e:
            raise SupermetricsError(
                f"Non-JSON response from Supermetrics: {resp.text[:500]}"
            ) from e

    @staticmethod
    def _rows_from_response(data: dict) -> list[dict[str, Any]]:
        """
        Normalize the Supermetrics response shape.

        The modern API returns:
            { "data": [[header_row], [row1], [row2], ...], "meta": {...} }

        We convert to list[dict] using the header row.
        """
        payload = data.get("data")
        if not payload:
            return []
        if isinstance(payload, list) and payload and isinstance(payload[0], list):
            header, *records = payload
            return [dict(zip(header, r, strict=False)) for r in records]
        # some connectors return list[dict] directly
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            return payload
        return []
