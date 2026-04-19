#!/usr/bin/env bash
#
# One-time bootstrap for a new GCP project. Creates:
#   * Artifact Registry repo
#   * Runtime service account + BQ + Secret Manager grants
#   * Supermetrics API key secret (reads from STDIN)
#   * BigQuery datasets + raw DDL (via `ssot bootstrap`)
#   * Cloud Scheduler job pointing at the Cloud Run Job
#
# Run interactively. Re-runs are safe (create-if-missing).
#
# Required env:
#   PROJECT_ID, REGION (e.g. asia-southeast1), JOB_NAME (e.g. ssot-daily),
#   REPO (e.g. ssot), SCHEDULE (e.g. "0 4 * * *" — 4am local in REGION)

set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
: "${REGION:=asia-southeast1}"
: "${JOB_NAME:=ssot-daily}"
: "${REPO:=ssot}"
: "${SCHEDULE:=0 4 * * *}"

SA_NAME="ssot-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "1/6 Enable APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  --project="${PROJECT_ID}"

echo "2/6 Artifact Registry repo"
gcloud artifacts repositories create "${REPO}" \
  --repository-format=docker --location="${REGION}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  (repo exists — ok)"

echo "3/6 Runtime service account"
gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  (sa exists — ok)"

for role in roles/bigquery.dataEditor roles/bigquery.jobUser \
            roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" --role="${role}" >/dev/null
done

echo "4/6 Supermetrics API key (Secret Manager)"
if ! gcloud secrets describe SUPERMETRICS_API_KEY --project="${PROJECT_ID}" >/dev/null 2>&1; then
  read -rsp "Paste Supermetrics API key: " KEY; echo
  printf "%s" "${KEY}" | gcloud secrets create SUPERMETRICS_API_KEY \
    --data-file=- --project="${PROJECT_ID}"
else
  echo "  (secret exists — skip. Use \`gcloud secrets versions add\` to rotate.)"
fi

echo "5/6 BigQuery datasets + DDL (ssot bootstrap — run AFTER first deploy)"
echo "    After the Cloud Run Job is deployed, run:"
echo "      gcloud run jobs execute ${JOB_NAME} --region=${REGION} --args=bootstrap"

echo "6/6 Cloud Scheduler (daily at ${SCHEDULE})"
gcloud scheduler jobs create http "${JOB_NAME}-trigger" \
  --location="${REGION}" \
  --schedule="${SCHEDULE}" \
  --time-zone="Asia/Singapore" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email="${SA_EMAIL}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  (scheduler job exists — skip)"

echo "Done. Next: push to main to trigger Cloud Build, then run bootstrap."
