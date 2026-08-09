#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CMS_APP_DIR:-/var/www/cms-bainslamusic}"
RUNNER="${APP_DIR}/scripts/run-ai-report.sh"

if [[ ! -x "${RUNNER}" ]]; then
  echo "Missing executable AI report runner: ${RUNNER}" >&2
  exit 1
fi

cat > /etc/cron.d/cms-bainslamusic-ai-report <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Tenant-scoped AI reports, 15:05 UTC (20:35 India time) every day.
5 15 * * * root ${RUNNER} >> /var/log/cms-bainslamusic-ai-report.log 2>&1
EOF
chmod 0644 /etc/cron.d/cms-bainslamusic-ai-report

cat > /etc/logrotate.d/cms-bainslamusic-ai-report <<'EOF'
/var/log/cms-bainslamusic-ai-report.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
chmod 0644 /etc/logrotate.d/cms-bainslamusic-ai-report
