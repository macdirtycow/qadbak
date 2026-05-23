#!/usr/bin/env bash
# One-shot: native Qadbak terminals (node-pty, pm2 qadbak-terminal, sudo, nginx /ws/*).
# Usage: sudo bash scripts/apply-terminal-native.sh
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/apply-terminal-native.sh" >&2
  exit 1
}

PORT="${QADBAK_TERMINAL_WS_PORT:-3001}"
PANEL_PORT="11000"
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source "$QADBAK_DIR/.env.local"
  PORT="${QADBAK_TERMINAL_WS_PORT:-$PORT}"
  PANEL_PORT="${QADBAK_PANEL_PORT:-$PANEL_PORT}"
fi

echo "==> Build tools for node-pty"
bash "$QADBAK_DIR/scripts/install-node-build-deps.sh"

echo "==> npm install (as $QADBAK_USER — node-pty must not be root-built)"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install"

echo "==> Sudo rules (domain + admin terminal)"
bash "$QADBAK_DIR/scripts/configure-domain-terminal-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-admin-terminal-sudo.sh"

echo "==> Panel nginx :$PANEL_PORT (/ws/domain-terminal + /ws/admin-terminal → :$PORT)"
bash "$QADBAK_DIR/scripts/apply-panel-nginx-fixes.sh" "$PANEL_PORT"

echo "==> pm2 (qadbak + qadbak-terminal)"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"

echo "==> Diagnostics"
bash "$QADBAK_DIR/scripts/check-terminal-ws.sh" || true

echo ""
echo "OK — terminals should work on http://<host>:$PANEL_PORT"
echo "  Domain: Domains → <domain> → Terminal"
echo "  Admin:  Server admin → Terminal"
