#!/usr/bin/env bash
# Diagnose and fix common VirtualMin/Webmin issues after Qadbak install.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
FQDN="$(hostname -f 2>/dev/null || hostname)"
PUBLIC_IP="$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/fix-virtualmin-access.sh" >&2
  exit 1
fi

echo "==> Webmin service"
systemctl is-active webmin &>/dev/null && echo "  webmin: active" || echo "  webmin: NOT running — try: systemctl start webmin"

echo ""
echo "==> remote.cgi (local API)"
CODE="$(curl -sk -o /dev/null -w "%{http_code}" -u root:"${VM_PASS:-}" \
  "https://127.0.0.1:10000/virtual-server/remote.cgi" 2>/dev/null || echo 000)"
echo "  HTTP $CODE (401/200 = Webmin reachable; 000 = down)"

if [[ -f "$ENV_FILE" ]]; then
  echo ""
  echo "==> Qadbak .env.local (API)"
  grep -E '^VIRTUALMIN_|^WEBMIN_|^NODE_TLS|^VIRTUALMIN_MOCK' "$ENV_FILE" | sed 's/PASS=.*/PASS=***/'
fi

echo ""
echo "==> Hostname (postfix/VirtualMin need a name, not bare IP)"
hostname -f
if hostname -f | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "  WARN: FQDN is an IP — fixing to $FQDN"
  hostnamectl set-hostname "$FQDN" 2>/dev/null || true
fi

echo ""
read -rp "Open Webmin port 10000 on firewalld/iptables? [y/N]: " OPEN
if [[ "$OPEN" =~ ^[Yy]$ ]]; then
  bash "$ROOT/scripts/open-host-firewall-port.sh" 10000
  echo "  Also add TCP 10000 Accept in Contabo cloud firewall."
fi

echo ""
read -rsp "Webmin root password (for test-api, Enter to skip): " VM_PASS
echo
if [[ -n "$VM_PASS" && -f "$ENV_FILE" ]]; then
  sed -i "s/^VIRTUALMIN_PASS=.*/VIRTUALMIN_PASS=$(printf '%s' "$VM_PASS" | sed 's/[&/]/\\&/g')/" "$ENV_FILE"
  echo "  Updated VIRTUALMIN_PASS in .env.local"
fi

WEBMIN_URL="https://${PUBLIC_IP}:10000"
if [[ -f "$ENV_FILE" ]]; then
  for key in WEBMIN_UI_URL VIRTUALMIN_UI_URL; do
    if grep -q "^${key}=" "$ENV_FILE"; then
      sed -i "s|^${key}=.*|${key}=${WEBMIN_URL}|" "$ENV_FILE"
    else
      echo "${key}=${WEBMIN_URL}" >>"$ENV_FILE"
    fi
  done
  if grep -q '^NODE_TLS_REJECT_UNAUTHORIZED=0' "$ENV_FILE" 2>/dev/null; then
    sed -i '/^NODE_TLS_REJECT_UNAUTHORIZED=/d' "$ENV_FILE"
    echo "    Removed global NODE_TLS_REJECT_UNAUTHORIZED=0 (use VIRTUALMIN_TLS_INSECURE instead)"
  fi
  grep -q '^VIRTUALMIN_TLS_INSECURE=' "$ENV_FILE" || \
    echo 'VIRTUALMIN_TLS_INSECURE=true' >>"$ENV_FILE"
  grep -q '^VIRTUALMIN_MOCK=' "$ENV_FILE" && \
    sed -i 's/^VIRTUALMIN_MOCK=.*/VIRTUALMIN_MOCK=false/' "$ENV_FILE"
  chown qadbak:qadbak "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

echo ""
echo "==> test-api as qadbak user"
if [[ -n "${VM_PASS:-}" ]]; then
  export VIRTUALMIN_PASS="$VM_PASS"
fi
sudo -u qadbak bash -c "cd '$ROOT' && npm run test-api" 2>&1 | tail -30 || true

echo ""
echo "==> Restart Qadbak"
sudo -u qadbak bash -c "cd '$ROOT' && pm2 restart qadbak"

echo ""
echo "============================================"
echo " Browser (admin): $WEBMIN_URL"
echo " Qadbak login:    http://${PUBLIC_IP}:11000/login"
echo " After login, Domains should list VM domains if test-api OK."
echo "============================================"
