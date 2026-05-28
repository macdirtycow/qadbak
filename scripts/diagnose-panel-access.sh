#!/usr/bin/env bash
# Print panel reachability diagnostics (origin + Cloudflare hints).
# Usage: sudo bash scripts/diagnose-panel-access.sh [panel.host.name]
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
TARGET="${1:-panel.siccamanagement.nl}"
ORIGIN_IP="$(curl -4 -fsS --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

echo "==> Panel diagnose: $TARGET"
echo "    Server IP: ${ORIGIN_IP}"
echo ""

echo "==> pm2 + app"
sudo -u qadbak pm2 list 2>/dev/null | grep -E 'qadbak|name' || true
curl -sf "http://127.0.0.1:3000/api/health" | head -c 300 || echo "FAIL :3000/api/health"
echo ""
echo ""

echo "==> Origin nginx (127.0.0.1)"
for proto in http https; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $TARGET" -k "$proto://127.0.0.1/login" 2>/dev/null || echo 000)"
  loc="$(curl -sI -H "Host: $TARGET" -k "$proto://127.0.0.1/login" 2>/dev/null | grep -i '^location:' | head -1 || true)"
  echo "    $proto://127.0.0.1/login → $code ${loc}"
done
echo ""

echo "==> Public IP :11000"
curl -sI "http://127.0.0.1:11000/login" | head -5
echo ""

echo "==> DNS (public)"
if command -v dig &>/dev/null; then
  dig +short A "$TARGET" || true
  dig +short AAAA "$TARGET" || true
else
  getent ahosts "$TARGET" 2>/dev/null | head -5 || true
fi
echo "    (Cloudflare proxied names show 104.x / 172.x — normal)"
echo "    Origin A should be: ${ORIGIN_IP}"
echo ""

echo "==> nginx vhost file"
grep -l "server_name.*${TARGET//./\\.}" /etc/nginx/sites-enabled/* 2>/dev/null || echo "    (no enabled site)"
echo ""

echo "==> TLS cert"
if [[ -f "/etc/letsencrypt/live/${TARGET}/fullchain.pem" ]]; then
  openssl x509 -in "/etc/letsencrypt/live/${TARGET}/fullchain.pem" -noout -subject -dates 2>/dev/null || true
else
  echo "    No LE cert at /etc/letsencrypt/live/${TARGET}/"
fi
echo ""

echo "Cloudflare checklist:"
echo "  • DNS: panel → ${ORIGIN_IP} (or CNAME to apex with same IP)"
echo "  • SSL: Flexible if only HTTP works on origin; Full if HTTPS → 200 above"
echo "  • Fix: sudo bash scripts/fix-panel-now.sh ${TARGET#panel.}"
