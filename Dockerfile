FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps — only what google-cloud-bigquery grpc needs
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src
COPY config ./config
COPY sql ./sql

# Install the package itself (pulls deps from pyproject.toml)
RUN pip install .

# Cloud Run Jobs set ENTRYPOINT via the container — we expose ssot CLI.
# Override CMD in the Cloud Run Job definition to select extract-all / transform / run.
ENTRYPOINT ["ssot"]
CMD ["run"]
