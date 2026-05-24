#!/usr/bin/env bash
# Minimal steps after git pull when you skip full update-qadbak.sh.
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/vps-after-pull.sh" >&2
  exit 1
fi

cd "$ROOT"
command -v jq &>/dev/null || apt-get install -y -qq jq

bash "$ROOT/scripts/fix-qadbak-ownership.sh"
sudo -u "$USER" bash -c "cd '$ROOT' && npm install && npm run build"
bash "$ROOT/scripts/configure-panel-vhost-sudo.sh" 2>/dev/null || true
bash "$ROOT/scripts/configure-updates-sudo.sh" 2>/dev/null || true
bash "$ROOT/scripts/configure-php-fpm-sudo.sh" 2>/dev/null || true
bash "$ROOT/scripts/configure-panel-pm2-sudo.sh" 2>/dev/null || true
bash "$ROOT/scripts/apply-all-php-fpm-pools.sh" 2>/dev/null || true
bash "$ROOT/scripts/pm2-restart-qadbak.sh"

echo "Done — panel, terminal WS, and PHP-FPM pools refreshed."
