#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CMS_APP_DIR:-/var/www/cms-bainslamusic}"
ENV_FILE="${APP_DIR}/.env.local"
REPORT_URL="${CMS_AI_REPORT_URL:-http://127.0.0.1:3190/api/ai/reports}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

CRON_SECRET="$(grep -E '^CRON_SECRET=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'")"

if [[ -z "${CRON_SECRET}" ]]; then
  echo "CRON_SECRET is not set in ${ENV_FILE}" >&2
  exit 1
fi

curl --fail --silent --show-error \
  --max-time 300 \
  --retry 2 \
  --retry-all-errors \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${REPORT_URL}"
echo
