#!/usr/bin/env bash
# Fast VPS deploy: git pull, production build, restart panel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/pull-build-restart.sh" >&2
  exit 1
fi

cd "$ROOT"
echo "==> git pull"
bash "$ROOT/scripts/reset-git-drift-before-pull.sh"
git pull

if [[ -f "$ROOT/scripts/fix-qadbak-ownership.sh" ]]; then
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
fi

echo "==> npm run build (as $USER)"
sudo -u "$USER" bash -c "cd '$ROOT' && npm run build"

echo "==> restart panel"
if systemctl list-unit-files qadbak.service &>/dev/null && [[ -f /etc/systemd/system/qadbak.service ]]; then
  systemctl restart qadbak
else
  bash "$ROOT/scripts/pm2-restart-qadbak.sh"
  echo ""
  echo "Tip: install systemd alias — sudo bash scripts/install-qadbak-systemd.sh"
fi

echo "Done."
