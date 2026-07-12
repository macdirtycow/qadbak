#!/usr/bin/env bash
# systemd helper — start/stop/reload Qadbak via pm2 (used by deploy/qadbak.service).
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
ACTION="${1:?usage: qadbak-service.sh start|stop|reload|status}"

case "$ACTION" in
  start | reload)
    bash "$ROOT/scripts/pm2-restart-qadbak.sh"
    ;;
  stop)
    bash "$ROOT/scripts/run-panel-pm2.sh" stop
    ;;
  status)
    bash "$ROOT/scripts/run-panel-pm2.sh" status
    ;;
  *)
    echo "Usage: qadbak-service.sh start|stop|reload|status" >&2
    exit 1
    ;;
esac
