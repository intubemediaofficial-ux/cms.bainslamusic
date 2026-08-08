#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CMS_APP_DIR:-/var/www/cms-bainslamusic}"
ENV_FILE="${APP_DIR}/.env.local"
SCAN_URL="${CMS_COPYRIGHT_SCAN_URL:-http://127.0.0.1:3190/api/copyright/scan}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

CRON_SECRET="$(sed -n 's/^CRON_SECRET=//p' "${ENV_FILE}" | tail -n 1 | tr -d '\r')"
CRON_SECRET="${CRON_SECRET#\"}"
CRON_SECRET="${CRON_SECRET%\"}"
CRON_SECRET="${CRON_SECRET#\'}"
CRON_SECRET="${CRON_SECRET%\'}"

if [[ -z "${CRON_SECRET}" ]]; then
  echo "CRON_SECRET is not configured" >&2
  exit 1
fi

LOCK_FILE="/var/lock/cms-copyright-scan.lock"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "copyright scan is already running"
  exit 0
fi

curl --fail --silent --show-error \
  --connect-timeout 10 \
  --max-time 900 \
  -X POST \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${SCAN_URL}"
echo
