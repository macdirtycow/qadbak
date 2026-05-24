#!/usr/bin/env bash
# Phase 8 on test VPS: hybrid provisioner, no Webmin UI, native domain registry.
# VirtualMin may stay installed for mail/DNS until fully replaced — not required for panel login.
#
# Usage: sudo bash /opt/qadbak/scripts/apply-phase8-test-server.sh
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-phase8-test-server.sh" >&2
  exit 1
fi

cd "$QADBAK_DIR"
echo "==> Phase 8 test-server apply (path to no Webmin UI)"

bash "$QADBAK_DIR/scripts/reset-git-drift-before-pull.sh"
git pull --ff-only
bash "$QADBAK_DIR/scripts/fix-qadbak-ownership.sh"

set_env_key() {
  local key="$1" val="$2" file="$QADBAK_DIR/.env.local"
  [[ -f "$file" ]] || touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

echo "==> Export native domain registry (from VirtualMin while available)"
bash "$QADBAK_DIR/scripts/export-native-domains.sh"

echo "==> .env.local phase 8"
set_env_key "QADBAK_PROVISIONER" "hybrid"
set_env_key "QADBAK_DISABLE_WEBMIN" "true"
set_env_key "QADBAK_VIRTUALMIN_FALLBACK" "true"
set_env_key "QADBAK_INDEPENDENCE_PHASE" "8"
set_env_key "QADBAK_NATIVE_INSTALL" "1"
# Keep TEST_DOMAIN for scripts
if grep -q '^TEST_DOMAIN=' "$QADBAK_DIR/.env.local" 2>/dev/null; then
  true
else
  FIRST="$(grep -o '"name":"[^"]*"' "$QADBAK_DIR/data/native-domains.json" 2>/dev/null | head -1 | sed 's/"name":"//;s/"//')"
  [[ -n "$FIRST" ]] && set_env_key "TEST_DOMAIN" "$FIRST"
fi

chown "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/.env.local"
chmod 600 "$QADBAK_DIR/.env.local"

echo "==> Sudo helpers + hosting (no Webmin embed)"
for helper in \
  configure-domain-fs-sudo.sh \
  configure-domain-repair-sudo.sh \
  configure-domain-terminal-sudo.sh \
  configure-host-services-sudo.sh \
  configure-stack-helper-sudo.sh; do
  bash "$QADBAK_DIR/scripts/$helper" || echo "    WARN: $helper" >&2
done
export QADBAK_NATIVE_INSTALL=1
export QADBAK_DISABLE_WEBMIN=1
bash "$QADBAK_DIR/scripts/install-hosting-stack.sh"

echo "==> Build + pm2"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/pm2-restart-qadbak.sh"

echo "==> E2E credentials"
if bash "$QADBAK_DIR/scripts/sync-e2e-credentials.sh"; then
  bash "$QADBAK_DIR/scripts/run-install-e2e.sh" || \
    echo "    WARN: E2E failed — set QADBAK_E2E_ADMIN_PASS in .env.local" >&2
else
  echo "    WARN: set QADBAK_E2E_ADMIN_PASS in .env.local then: sudo bash scripts/sync-e2e-credentials.sh" >&2
fi

echo "==> Preflight"
sudo -u "$QADBAK_USER" bash "$QADBAK_DIR/scripts/v1-test-preflight.sh" || true

HEALTH="$(curl -sf "http://127.0.0.1:3000/api/health" 2>/dev/null || echo '{}')"
echo "$HEALTH" | head -c 300
echo ""

echo ""
echo "Done — phase 8 hybrid on this VPS."
echo "  Panel lists domains from data/native-domains.json (no Webmin UI)."
echo "  Mail/DNS/etc. still use VirtualMin API until native replacements exist."
echo "  Enable native modules: sudo bash scripts/apply-phase8-native-enable.sh"
echo "  Or stepwise: sudo bash scripts/apply-phase8-native-phase.sh ssl,dns"
echo "  Audit: bash scripts/audit-vm-dependency.sh"
