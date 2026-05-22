#!/usr/bin/env bash
# Phase 6 on an EXISTING VirtualMin test VPS (e.g. siccamanagement.nl on Contabo).
# Keeps VirtualMin as provisioning engine; adds native stack packages + all helpers.
# Does NOT run virtualmin-install.sh or remove Webmin.
#
# Usage: sudo bash /opt/qadbak/scripts/apply-phase6-test-server.sh
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-phase6-test-server.sh" >&2
  exit 1
fi

cd "$QADBAK_DIR"
echo "==> Phase 6 test-server apply ($QADBAK_DIR)"
echo "    Keeps VirtualMin; idempotent stack + helpers + nginx for customer domains."

if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(QADBAK_PUBLIC_HOST|PANEL_HOST)=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
fi
export PANEL_HOST="${PANEL_HOST:-${QADBAK_PUBLIC_HOST:-$(hostname -f)}}"
export SERVER_FQDN="${SERVER_FQDN:-$(hostname -f)}"
export DETECT_DOMAIN="${DETECT_DOMAIN:-siccamanagement.nl}"

set_env_key() {
  local key="$1" val="$2" file="$QADBAK_DIR/.env.local"
  [[ -f "$file" ]] || touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

echo "==> git pull"
if ! git diff --quiet package-lock.json 2>/dev/null; then
  git checkout -- package-lock.json
fi
git pull --ff-only

bash "$QADBAK_DIR/scripts/fix-qadbak-ownership.sh"

echo "==> Native stack packages (idempotent)"
if ! bash "$QADBAK_DIR/scripts/install-native-stack.sh"; then
  echo "    WARN: install-native-stack had issues — running Apache repair" >&2
  bash "$QADBAK_DIR/scripts/fix-apache-phase6.sh" || true
fi

if ! systemctl is-active --quiet apache2 2>/dev/null; then
  echo "==> Apache not running — repair before continuing"
  bash "$QADBAK_DIR/scripts/fix-apache-phase6.sh"
fi

echo "==> Sudo helpers"
for helper in \
  configure-domain-fs-sudo.sh \
  configure-domain-repair-sudo.sh \
  configure-domain-terminal-sudo.sh \
  configure-host-services-sudo.sh \
  configure-stack-helper-sudo.sh; do
  echo "    $helper"
  if ! bash "$QADBAK_DIR/scripts/$helper"; then
    echo "    WARN: $helper failed — continuing" >&2
  fi
done

echo "==> .env.local markers (phase 6 hybrid test server)"
set_env_key "QADBAK_INSTALL_MODE" "hybrid"
set_env_key "QADBAK_TEST_SERVER" "siccamanagement.nl"
chown "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/.env.local"
chmod 600 "$QADBAK_DIR/.env.local"

echo "==> Hosting stack + customer vhosts (VirtualMin stays)"
unset QADBAK_NATIVE_INSTALL
bash "$QADBAK_DIR/scripts/install-hosting-stack.sh"

FIRST_DOMAIN=""
if command -v virtualmin &>/dev/null; then
  FIRST_DOMAIN="$(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d' | grep -E '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' | head -1 || true)"
fi
if [[ -n "$FIRST_DOMAIN" ]]; then
  echo "==> Website probe: $FIRST_DOMAIN"
  curl -sSI -H "Host: $FIRST_DOMAIN" http://127.0.0.1/ | head -5 || true
fi

echo "==> Build + pm2 (as $QADBAK_USER)"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/pm2-restart-qadbak.sh"

echo "==> Preflight"
sudo -u "$QADBAK_USER" bash "$QADBAK_DIR/scripts/v1-test-preflight.sh" || true

echo ""
echo "Done — phase 6 applied on this test VPS (VirtualMin + native helpers)."
echo "  Panel: check Server admin → Stack config, Status, Services"
echo "  Domain: https://your-panel/domains/siccamanagement.nl (or first VM domain)"
echo "  Webmin :10000 remains break-glass only — daily work in Qadbak."
