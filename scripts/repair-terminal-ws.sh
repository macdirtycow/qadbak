#!/usr/bin/env bash
# Fix qadbak-terminal when ws/node-pty cannot be resolved (after git pull).
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/repair-terminal-ws.sh" >&2
  exit 1
fi

bash "$ROOT/scripts/fix-qadbak-ownership.sh"
bash "$ROOT/scripts/install-node-build-deps.sh" 2>/dev/null || true
sudo -u "$USER" bash -c "cd '$ROOT' && npm install --no-audit --no-fund"
bash "$ROOT/scripts/ensure-terminal-deps.sh"
sudo -u "$USER" bash -c "cd '$ROOT' && pm2 restart qadbak-terminal"
sleep 2
bash "$ROOT/scripts/check-terminal-ws.sh"
