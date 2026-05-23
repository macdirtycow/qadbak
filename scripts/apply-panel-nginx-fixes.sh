#!/usr/bin/env bash
# Re-apply panel nginx (upload limit 64m, terminal WebSocket proxy).
# Usage: sudo bash scripts/apply-panel-nginx-fixes.sh [PORT]
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
PORT="${1:-11000}"
[[ -f "$ROOT/.env.local" ]] && source "$ROOT/.env.local"
PORT="${QADBAK_PANEL_PORT:-$PORT}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
bash "$ROOT/scripts/enable-panel-port.sh" "$PORT"
echo "OK — panel :$PORT nginx refreshed (client_max_body_size 64m, /ws/domain-terminal → :3001)"
