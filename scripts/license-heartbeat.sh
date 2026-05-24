#!/usr/bin/env bash
# Daily license heartbeat (systemd timer or cron).
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
cd "$ROOT"
if [[ "$(id -un)" == "$USER" ]]; then
  node scripts/qadbak-license-cli.mjs heartbeat
else
  sudo -u "$USER" node scripts/qadbak-license-cli.mjs heartbeat
fi
