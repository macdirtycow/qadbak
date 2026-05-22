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
run_as_qadbak "cd '$ROOT' && \
  if ! git diff --quiet package-lock.json 2>/dev/null; then \
    echo '    Reset package-lock.json (local npm drift)'; \
    git checkout -- package-lock.json; \
  fi && \
  git pull"

echo "==> Build"
run_as_qadbak "cd '$ROOT' && npm install && npm run build"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "==> Hosting stack + sudo helpers"
  bash "$ROOT/scripts/configure-domain-fs-sudo.sh" 2>/dev/null || true
  bash "$ROOT/scripts/configure-domain-repair-sudo.sh" 2>/dev/null || true
  bash "$ROOT/scripts/configure-domain-terminal-sudo.sh" 2>/dev/null || true
  bash "$ROOT/scripts/install-hosting-stack.sh" || true
fi

echo "==> Restart (load .env.local into pm2)"
run_as_qadbak "cd '$ROOT' && bash scripts/pm2-restart-qadbak.sh"

echo "==> Verify"
run_as_qadbak "cd '$ROOT' && bash scripts/v1-test-preflight.sh" || true
curl -sf "http://127.0.0.1:${PORT:-3000}/api/health" | head -c 200
echo ""
echo "Done."
