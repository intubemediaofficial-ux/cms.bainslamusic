#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CMS_APP_DIR:-/var/www/cms-bainslamusic}"
RUNNER="${APP_DIR}/scripts/run-cms-data-sync.sh"

if [[ ! -x "${RUNNER}" ]]; then
  echo "Missing executable sync runner: ${RUNNER}" >&2
  exit 1
fi

# Bainsla-scoped filenames: the other CMS on this host installs its own crons.
cat > /etc/cron.d/cms-bainslamusic-data-sync <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Lightweight channel statistics refresh every 30 minutes.
*/30 * * * * root ${RUNNER} stats >> /var/log/cms-bainslamusic-data-sync-stats.log 2>&1
# Retry delayed YouTube revenue at 06:05, 08:05, 10:05, 12:05 and 14:05 India time.
# Successful channels are skipped for later attempts on the same reporting date.
35 0,2,4,6,8 * * * root ${RUNNER} revenue >> /var/log/cms-bainslamusic-data-sync-revenue.log 2>&1
# Refresh all vendor Google Sheet tabs daily at 20:00 India time (14:30 UTC).
30 14 * * * root ${RUNNER} sheet >> /var/log/cms-bainslamusic-data-sync-sheet.log 2>&1
# Twice a month, re-pull every channel's monthly revenue from YouTube so later
# revisions land in the dashboard and the sheets (3rd and 18th, 01:20 UTC).
20 1 3,18 * * root ${RUNNER} monthly >> /var/log/cms-bainslamusic-data-sync-monthly.log 2>&1
EOF
chmod 0644 /etc/cron.d/cms-bainslamusic-data-sync

cat > /etc/logrotate.d/cms-bainslamusic-data-sync <<'EOF'
/var/log/cms-bainslamusic-data-sync-stats.log /var/log/cms-bainslamusic-data-sync-revenue.log /var/log/cms-bainslamusic-data-sync-sheet.log /var/log/cms-bainslamusic-data-sync-monthly.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
chmod 0644 /etc/logrotate.d/cms-bainslamusic-data-sync
