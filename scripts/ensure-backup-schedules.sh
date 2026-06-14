#!/usr/bin/env bash
# Enable automatic backups for all customer domains and run stale backups now.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
PAYLOAD="${1:-{\"runStale\":true,\"staleDays\":1}}"
exec sudo -u "$USER" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" backup-schedule-ensure-all "$PAYLOAD"
