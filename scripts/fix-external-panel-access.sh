#!/usr/bin/env bash
# Fix panel reachable from the internet (host firewall + nginx alt port).
# Run on the VPS as root after install when Mac gets "Connection refused".
set -euo pipefail

PORT="${1:-11000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/fix-external-panel-access.sh [$PORT]" >&2
  exit 1
fi

echo "==> Session cookies for HTTP panel (non-TLS port $PORT)"
ENV_FILE="/opt/qadbak/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^QADBAK_COOKIE_SECURE=' "$ENV_FILE"; then
    sed -i 's/^QADBAK_COOKIE_SECURE=.*/QADBAK_COOKIE_SECURE=false/' "$ENV_FILE"
  else
    echo "QADBAK_COOKIE_SECURE=false" >>"$ENV_FILE"
  fi
  echo "    Set QADBAK_COOKIE_SECURE=false in .env.local (required for http://IP:$PORT)"
fi

echo "==> Ensure Qadbak is running"
sudo -u qadbak bash -c "cd /opt/qadbak && pm2 restart qadbak" 2>/dev/null || true

echo "==> nginx + OS firewall on port $PORT"
bash "$ROOT/scripts/enable-panel-port.sh" "$PORT"

echo ""
echo "==> Quick checks (on server)"
ss -tlnp | grep ":$PORT " || true
curl -sI "http://127.0.0.1:$PORT/login" | head -3 || true

PUBLIC_IP="$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""
echo "============================================"
echo " From your Mac (NOT on the server):"
echo "   nc -zv $PUBLIC_IP $PORT"
echo "   http://$PUBLIC_IP:$PORT/login"
echo ""
echo " Contabo firewall (required):"
echo "   1) TCP 22 Accept"
echo "   2) TCP $PORT Accept  (Source: Any)"
echo "   3) Block all Drop"
echo "   Active VPS/VDS must include this server"
echo "============================================"
