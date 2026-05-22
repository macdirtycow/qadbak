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
if [[ "$(id -u)" -eq 0 ]]; then
  # Pull as root is common on VPS; fix ownership before npm run as qadbak.
  cd "$ROOT"
  if ! git diff --quiet package-lock.json 2>/dev/null; then
    echo "    Reset package-lock.json (local npm drift)"
    git checkout -- package-lock.json
  fi
  git pull
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
  bash "$ROOT/scripts/install-node-build-deps.sh" 2>/dev/null || true
else
  run_as_qadbak "cd '$ROOT' && \
    if ! git diff --quiet package-lock.json 2>/dev/null; then \
      echo '    Reset package-lock.json (local npm drift)'; \
      git checkout -- package-lock.json; \
    fi && \
    git pull"
fi

echo "==> Build (as $USER — never npm install as root)"
run_as_qadbak "cd '$ROOT' && npm install && npm run build"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "==> Sudo helpers"
  for helper in \
    configure-domain-fs-sudo.sh \
    configure-domain-repair-sudo.sh \
    configure-domain-terminal-sudo.sh \
    configure-host-services-sudo.sh \
    configure-stack-helper-sudo.sh; do
    echo "    $helper"
    if ! bash "$ROOT/scripts/$helper"; then
      echo "    WARN: $helper failed (see above)" >&2
    fi
  done
  echo "==> Hosting stack (nginx, Apache, Webmin embed)"
  bash "$ROOT/scripts/install-hosting-stack.sh" || echo "    WARN: install-hosting-stack.sh failed" >&2
fi

echo "==> Restart (load .env.local into pm2)"
run_as_qadbak "cd '$ROOT' && bash scripts/pm2-restart-qadbak.sh"

echo "==> Verify"
run_as_qadbak "cd '$ROOT' && bash scripts/v1-test-preflight.sh" || true
curl -sf "http://127.0.0.1:${PORT:-3000}/api/health" | head -c 200
echo ""
if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/apply-phase6-test-server.sh" ]]; then
  echo "Test VPS (hybrid phase 6): sudo bash $ROOT/scripts/apply-phase6-test-server.sh"
fi
echo "Done."
