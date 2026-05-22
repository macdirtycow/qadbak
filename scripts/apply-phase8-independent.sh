#!/usr/bin/env bash
# Phase 8 ONAFHANKELIJK: QADBAK_PROVISIONER=native, no VirtualMin API fallback.
# Panel uses only native modules + domain registry. Other tabs error until native exists.
#
# Safe order:
#   1. sudo bash scripts/apply-phase8-native-enable.sh   # hybrid + all native modules
#   2. Test panel on TEST_DOMAIN
#   3. sudo bash scripts/apply-phase8-independent.sh     # this script
#
# Revert:
#   QADBAK_PROVISIONER=hybrid
#   QADBAK_VIRTUALMIN_FALLBACK=true
#   sudo -u qadbak bash -c 'cd /opt/qadbak && bash scripts/pm2-restart-qadbak.sh'
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

cd "$QADBAK_DIR"
echo "==> Phase 8 INDEPENDENT (geen VirtualMin API fallback)"

bash "$QADBAK_DIR/scripts/reset-git-drift-before-pull.sh"
git pull --ff-only
bash "$QADBAK_DIR/scripts/fix-qadbak-ownership.sh"

FEATURES="${1:-ssl,dns,mail,db,backup,cron}"

echo "==> Ensure native modules (hybrid rollout)"
bash "$QADBAK_DIR/scripts/apply-phase8-native-phase.sh" "$FEATURES"

echo "==> Independent preflight"
bash "$QADBAK_DIR/scripts/preflight-phase8-independent.sh"

set_env() {
  local k="$1" v="$2"
  grep -q "^${k}=" "$QADBAK_DIR/.env.local" 2>/dev/null && \
    sed -i "s|^${k}=.*|${k}=${v}|" "$QADBAK_DIR/.env.local" || \
    echo "${k}=${v}" >>"$QADBAK_DIR/.env.local"
}

set_env QADBAK_PROVISIONER native
set_env QADBAK_VIRTUALMIN_FALLBACK false
set_env QADBAK_DISABLE_WEBMIN true
set_env QADBAK_INDEPENDENCE_PHASE 8-independent

chown "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/.env.local"

sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm run build"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/pm2-restart-qadbak.sh"

HEALTH="$(curl -sf "http://127.0.0.1:3000/api/health" 2>/dev/null || echo '{}')"
echo "$HEALTH" | head -c 400
echo ""

echo ""
echo "OK — Phase 8 INDEPENDENT"
echo "  provisioner=native, VirtualMin API fallback=OFF"
echo "  Werkt zonder remote.cgi: ssl, dns, mail, db, backup, cron (+ files/terminal via helpers)"
echo "  FTP, PHP, aliases, redirects, … geven een duidelijke fout tot native bestaat"
echo ""
echo "  Terug naar hybrid: set QADBAK_PROVISIONER=hybrid + QADBAK_VIRTUALMIN_FALLBACK=true, pm2 restart"
echo "  apt remove webmin: NOG NIET — mail gebruikt nog virtualmin CLI"
