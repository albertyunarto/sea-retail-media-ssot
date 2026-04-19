"""Smoke tests for the Supermetrics client — no live API calls."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pytest

from ssot.config import SourceConfig
from ssot.supermetrics import QueryWindow, SupermetricsClient


def _src() -> SourceConfig:
    return SourceConfig(
        name="tiktok_ads",
        ds_id="TT",
        raw_table="proj.raw_supermetrics.tiktok_ads_daily",
        fields=["Date", "Campaign_id", "Spend"],
        n_days=2,
    )


def test_row_normalization_from_2d_array():
    data = {
        "data": [
            ["Date", "Campaign_id", "Spend"],
            ["2026-04-01", "CMP1", 10.5],
            ["2026-04-02", "CMP1", 8.0],
        ]
    }
    rows = SupermetricsClient._rows_from_response(data)
    assert rows == [
        {"Date": "2026-04-01", "Campaign_id": "CMP1", "Spend": 10.5},
        {"Date": "2026-04-02", "Campaign_id": "CMP1", "Spend": 8.0},
    ]


def test_row_normalization_handles_list_of_dicts():
    data = {"data": [{"Date": "2026-04-01", "Spend": 10.0}]}
    assert SupermetricsClient._rows_from_response(data) == [
        {"Date": "2026-04-01", "Spend": 10.0}
    ]


def test_row_normalization_empty():
    assert SupermetricsClient._rows_from_response({}) == []
    assert SupermetricsClient._rows_from_response({"data": []}) == []


def test_query_skips_empty_accounts(caplog):
    c = SupermetricsClient(api_key="x")
    assert c.query(source=_src(), accounts=[], window=QueryWindow(date(2026, 4, 1), date(2026, 4, 2))) == []


def test_build_payload_shape():
    c = SupermetricsClient(api_key="x")
    payload = c._build_payload(
        source=_src(),
        accounts=["act_1", "act_2"],
        window=QueryWindow(date(2026, 4, 1), date(2026, 4, 2)),
        extra_filters=None,
    )
    assert payload["ds_id"] == "TT"
    assert payload["ds_accounts"] == ["act_1", "act_2"]
    assert payload["start_date"] == "2026-04-01"
    assert payload["end_date"] == "2026-04-02"
    assert "Spend" in payload["fields"]
