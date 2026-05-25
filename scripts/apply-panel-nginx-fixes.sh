#!/usr/bin/env bash
# Re-apply panel nginx (upload limit 100g, terminal WebSocket proxy).
# Usage: sudo bash scripts/apply-panel-nginx-fixes.sh [PORT]
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
# Do NOT `source .env.local` — PORT=3000 (Next.js) would override the panel port argument.
# shellcheck source=scripts/lib/read-env-local.sh
source "$ROOT/scripts/lib/read-env-local.sh"
PANEL_PORT="${1:-$(read_env_local_key QADBAK_PANEL_PORT 11000)}"
PANEL_PORT="$(read_env_local_key QADBAK_PANEL_PORT "$PANEL_PORT")"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
if [[ "$PANEL_PORT" == "3000" ]]; then
  echo "Refusing panel nginx on port 3000 (Next.js app port). Use 11000 or set QADBAK_PANEL_PORT." >&2
  exit 1
fi
bash "$ROOT/scripts/enable-panel-port.sh" "$PANEL_PORT"
echo "OK — panel :$PANEL_PORT nginx → 127.0.0.1:3000 (100g upload, /ws/* → :3001)"
