#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CMS_APP_DIR:-/var/www/cms-frontend}"
RUNNER="${APP_DIR}/scripts/run-cms-data-sync.sh"

if [[ ! -x "${RUNNER}" ]]; then
  echo "Missing executable sync runner: ${RUNNER}" >&2
  exit 1
fi

cat > /etc/cron.d/cms-data-sync <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Lightweight channel statistics refresh every 30 minutes.
*/30 * * * * root ${RUNNER} stats >> /var/log/cms-data-sync-stats.log 2>&1
# Retry delayed YouTube revenue at 06:05, 08:05, 10:05, 12:05, and 14:05 India time.
# Successful channels are skipped for later attempts on the same reporting date.
35 0,2,4,6,8 * * * root ${RUNNER} revenue >> /var/log/cms-data-sync-revenue.log 2>&1
# Refresh all vendor Google Sheet tabs daily at 20:00 India time (14:30 UTC).
30 14 * * * root ${RUNNER} sheet >> /var/log/cms-data-sync-sheet.log 2>&1
EOF
chmod 0644 /etc/cron.d/cms-data-sync

cat > /etc/logrotate.d/cms-data-sync <<'EOF'
/var/log/cms-data-sync-stats.log /var/log/cms-data-sync-revenue.log /var/log/cms-data-sync-sheet.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
chmod 0644 /etc/logrotate.d/cms-data-sync
