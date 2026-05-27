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

echo "==> Sync git $ROOT"
if [[ "$(id -u)" -eq 0 ]]; then
  # Pull as root is common on VPS; fix ownership before npm run as qadbak.
  cd "$ROOT"
  bash "$ROOT/scripts/reset-git-drift-before-pull.sh"
  bash "$ROOT/scripts/git-sync-origin.sh"
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
  bash "$ROOT/scripts/install-node-build-deps.sh" 2>/dev/null || true
else
  run_as_qadbak "cd '$ROOT' && bash scripts/reset-git-drift-before-pull.sh && bash scripts/git-sync-origin.sh"
fi

ENV_FILE="$ROOT/.env.local"
# Ensure imap is in native features (webmail + Dovecot folders on existing installs).
if [[ -f "$ENV_FILE" ]] && grep -q '^QADBAK_NATIVE_FEATURES=' "$ENV_FILE" 2>/dev/null; then
  if ! grep '^QADBAK_NATIVE_FEATURES=' "$ENV_FILE" | grep -qE '(^|,)(imap)(,|$)'; then
    sed -i.bak -E 's/^(QADBAK_NATIVE_FEATURES=.*)$/\1,imap/' "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    echo "==> Added imap to QADBAK_NATIVE_FEATURES (restart after build)"
  fi
fi
if [[ -f "$ENV_FILE" ]] && ! grep -q '^QADBAK_INSTALL_SALT=' "$ENV_FILE" 2>/dev/null; then
  SALT="$(openssl rand -hex 8 2>/dev/null || head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "QADBAK_INSTALL_SALT=$SALT" >>"$ENV_FILE"
  echo "NEXT_PUBLIC_QADBAK_API_SALT=$SALT" >>"$ENV_FILE"
  echo "==> Added QADBAK_INSTALL_SALT to .env.local (rebuild required)"
fi

echo "==> Build (as $USER — never npm install/build as root)"
if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/fix-qadbak-ownership.sh" ]]; then
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
fi
run_as_qadbak "cd '$ROOT' && npm install && npm run build"
bash "$ROOT/scripts/ensure-terminal-deps.sh"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "==> Sudo helpers"
  for helper in \
    configure-domain-fs-sudo.sh \
    configure-domain-repair-sudo.sh \
    configure-panel-vhost-sudo.sh \
    configure-updates-sudo.sh \
    configure-php-fpm-sudo.sh \
    configure-panel-pm2-sudo.sh \
    configure-domain-terminal-sudo.sh \
    configure-host-services-sudo.sh \
    configure-stack-helper-sudo.sh \
    configure-provisioning-helper-sudo.sh; do
    echo "    $helper"
    if ! bash "$ROOT/scripts/$helper"; then
      echo "    WARN: $helper failed (see above)" >&2
    fi
  done
  echo "==> Hosting stack (nginx, Apache)"
  QADBAK_NATIVE_INSTALL=1 QADBAK_DISABLE_WEBMIN=true \
    bash "$ROOT/scripts/install-hosting-stack.sh" || echo "    WARN: install-hosting-stack.sh failed" >&2
fi

echo "==> Restart (load .env.local into pm2)"
run_as_qadbak "cd '$ROOT' && bash scripts/pm2-restart-qadbak.sh"

if [[ -f "$ROOT/data/license.json" ]]; then
  echo "==> License heartbeat (open-core: no artifact sync needed)"
  run_as_qadbak "cd '$ROOT' && node scripts/qadbak-license-cli.mjs heartbeat" || \
    echo "    WARN: heartbeat call failed — the in-process scheduler will retry." >&2
fi

echo "==> Verify"
run_as_qadbak "cd '$ROOT' && bash scripts/v1-test-preflight.sh" || true
curl -sf "http://127.0.0.1:${PORT:-3000}/api/health" | head -c 200
echo ""

if [[ "$(id -u)" -eq 0 ]]; then
  if bash "$ROOT/scripts/sync-e2e-credentials.sh" 2>/dev/null; then
    echo "==> Install E2E (Playwright on live panel)"
    bash "$ROOT/scripts/run-install-e2e.sh" || echo "    WARN: install E2E failed (see above)" >&2
  else
    echo "==> Install E2E skipped — set QADBAK_E2E_ADMIN_PASS in .env.local, then:" >&2
    echo "    sudo bash $ROOT/scripts/sync-e2e-credentials.sh" >&2
  fi
fi
if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/configure-bind-native.sh" ]]; then
  echo ""
  echo "==> BIND9 (native DNS)"
  bash "$ROOT/scripts/configure-bind-native.sh" 2>/dev/null || true
fi
if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/configure-native-mail.sh" ]]; then
  echo ""
  echo "==> Mail stack sync"
  bash "$ROOT/scripts/configure-native-mail.sh" --force 2>/dev/null || true
  sudo -u "$USER" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" mail-sync 2>/dev/null || true
fi
if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/apply-phase8-independent.sh" ]]; then
  echo "Re-apply native flags: sudo bash $ROOT/scripts/apply-phase8-independent.sh"
fi
echo "Done."
