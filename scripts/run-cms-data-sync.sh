#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
APP_DIR="${CMS_APP_DIR:-/var/www/cms-bainslamusic}"
ENV_FILE="${APP_DIR}/.env.local"
SYNC_URL="${CMS_SYNC_URL:-http://127.0.0.1:3190/api/sync-client-data}"

if [[ "${MODE}" != "stats" && "${MODE}" != "revenue" && "${MODE}" != "sheet" && "${MODE}" != "monthly" ]]; then
  echo "Usage: $0 stats|revenue|sheet|monthly" >&2
  exit 2
fi

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

LOCK_FILE="/var/lock/cms-bainslamusic-data-sync-${MODE}.lock"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "${MODE} sync is already running"
  exit 0
fi

MAX_TIME=180
QUERY="mode=${MODE}"
if [[ "${MODE}" == "revenue" ]]; then
  MAX_TIME=900
elif [[ "${MODE}" == "sheet" ]]; then
  MAX_TIME=300
  QUERY="action=vendor-sheet"
elif [[ "${MODE}" == "monthly" ]]; then
  MAX_TIME=1800
  QUERY="action=monthly-resync&months=${CMS_RESYNC_MONTHS:-2}"
fi

curl --fail --silent --show-error \
  --connect-timeout 10 \
  --max-time "${MAX_TIME}" \
  --retry 2 \
  --retry-all-errors \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${SYNC_URL}?${QUERY}"
echo
