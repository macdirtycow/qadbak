#!/usr/bin/env bash
# Update Qadbak from git and restart (run on server as root or qadbak user).
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"

run_as_qadbak() {
  if [[ "$(id -un)" == "$USER" ]]; then
    bash -c "$1"
  else
    sudo -u "$USER" bash -c "$1"
  fi
}

echo "==> Pull $ROOT"
run_as_qadbak "cd '$ROOT' && git pull"

echo "==> Build"
run_as_qadbak "cd '$ROOT' && npm install && npm run build"

echo "==> Restart (load .env.local into pm2)"
run_as_qadbak "cd '$ROOT' && bash scripts/pm2-restart-qadbak.sh"

echo "==> Verify"
run_as_qadbak "cd '$ROOT' && bash scripts/v1-test-preflight.sh" || true
curl -sf "http://127.0.0.1:${PORT:-3000}/api/health" | head -c 200
echo ""
echo "Done."
