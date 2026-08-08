#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CMS_APP_DIR:-/var/www/cms-bainslamusic}"
RUNNER="${APP_DIR}/scripts/run-copyright-scan.sh"

if [[ ! -x "${RUNNER}" ]]; then
  echo "Missing executable scan runner: ${RUNNER}" >&2
  exit 1
fi

# The endpoint decides whether today is a scan day (Daily / Mon-Wed-Fri /
# Weekly) and how much of the catalog to cover, so cron just calls it daily.
cat > /etc/cron.d/cms-copyright-scan <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Copyright scan slice, 03:15 UTC (08:45 India time) every day.
15 3 * * * root ${RUNNER} >> /var/log/cms-copyright-scan.log 2>&1
EOF
chmod 0644 /etc/cron.d/cms-copyright-scan

cat > /etc/logrotate.d/cms-copyright-scan <<'EOF'
/var/log/cms-copyright-scan.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
chmod 0644 /etc/logrotate.d/cms-copyright-scan
