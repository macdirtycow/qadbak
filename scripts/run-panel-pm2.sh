#!/usr/bin/env bash
# Qadbak panel process control for admin dashboard (pm2).
# Usage: sudo bash scripts/run-panel-pm2.sh status|restart|stop|start|restart-terminal|restart-all
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
ACTION="${1:-}"

run_pm2() {
  if [[ "$(id -un)" == "$USER" ]]; then
    bash -c "$1"
  else
    sudo -u "$USER" bash -c "$1"
  fi
}

case "$ACTION" in
  status)
    run_pm2 "cd '$ROOT' && pm2 jlist 2>/dev/null || pm2 list --json 2>/dev/null || pm2 list"
    ;;
  restart)
    run_pm2 "cd '$ROOT' && pm2 restart qadbak qadbak-terminal 2>/dev/null || pm2 restart all"
    echo '{"ok":true,"action":"restart"}'
    ;;
  stop)
    run_pm2 "cd '$ROOT' && pm2 stop qadbak qadbak-terminal 2>/dev/null || true"
    echo '{"ok":true,"action":"stop"}'
    ;;
  start)
    run_pm2 "cd '$ROOT' && pm2 start ecosystem.config.cjs"
    echo '{"ok":true,"action":"start"}'
    ;;
  restart-terminal)
    run_pm2 "cd '$ROOT' && pm2 restart qadbak-terminal"
    echo '{"ok":true,"action":"restart-terminal"}'
    ;;
  restart-all)
    if [[ "$(id -u)" -eq 0 ]]; then
      bash "$ROOT/scripts/pm2-restart-qadbak.sh"
    else
      sudo bash "$ROOT/scripts/pm2-restart-qadbak.sh"
    fi
    echo '{"ok":true,"action":"restart-all"}'
    ;;
  __probe__)
    echo "OK"
    ;;
  *)
    echo "Usage: run-panel-pm2.sh status|restart|stop|start|restart-terminal|restart-all" >&2
    exit 1
    ;;
esac
