"""GCP Secret Manager wrapper with local .env fallback for dev."""

from __future__ import annotations

import os
from functools import lru_cache

from google.cloud import secretmanager

from .logging_conf import get_logger

log = get_logger(__name__)


@lru_cache(maxsize=None)
def get_secret(name: str, version: str = "latest") -> str:
    """
    Fetch a secret. Resolution order:
      1) env var with same name (useful for local dev / GH Actions)
      2) GCP Secret Manager at projects/{GCP_PROJECT}/secrets/{name}/versions/{version}
    """
    if name in os.environ:
        log.info("secret.from_env", name=name)
        return os.environ[name]

    project = os.environ.get("GCP_PROJECT")
    if not project:
        raise RuntimeError(
            f"GCP_PROJECT not set and {name} not in env — cannot resolve secret."
        )
    client = secretmanager.SecretManagerServiceClient()
    path = f"projects/{project}/secrets/{name}/versions/{version}"
    log.info("secret.from_secret_manager", name=name, version=version)
    resp = client.access_secret_version(request={"name": path})
    return resp.payload.data.decode("utf-8")
