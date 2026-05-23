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

# shellcheck source=scripts/lib/read-env-local.sh
source "$QADBAK_DIR/scripts/lib/read-env-local.sh"
PORT="$(read_env_local_key QADBAK_TERMINAL_WS_PORT 3001)"
PANEL_PORT="$(read_env_local_key QADBAK_PANEL_PORT 11000)"

echo "==> Build tools for node-pty"
bash "$QADBAK_DIR/scripts/install-node-build-deps.sh"

bash "$QADBAK_DIR/scripts/ensure-terminal-deps.sh"

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
