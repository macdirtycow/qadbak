#!/usr/bin/env bash
# Standard VPS update: git pull → sudoers → build → restart panel + terminal.
# Run on the server as root:
#   sudo bash /opt/qadbak/scripts/update.sh
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/update.sh" >&2
  exit 1
fi

cd "$ROOT"
export QADBAK_DIR="$ROOT"

echo "==> git pull"
bash "$ROOT/scripts/reset-git-drift-before-pull.sh"
git pull

echo "==> sudo helpers"
bash "$ROOT/scripts/configure-all-sudo.sh"

if [[ -f "$ROOT/scripts/fix-qadbak-ownership.sh" ]]; then
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
fi

echo "==> npm build (as $USER)"
sudo -u "$USER" bash -c "cd '$ROOT' && npm install --no-audit --no-fund && npm run build"

echo "==> restart panel + terminal"
bash "$ROOT/scripts/pm2-restart-qadbak.sh"

echo "Done — panel and terminal WS updated."
