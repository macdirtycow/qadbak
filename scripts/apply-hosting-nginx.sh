#!/usr/bin/env bash
# Re-apply nginx: customer domains → Apache; Qadbak only on panel hostname (+ optional :11000).
# Run on VPS as root after git pull.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-hosting-nginx.sh" >&2
  exit 1
fi

PANEL_HOST="${PANEL_HOST:-}"
SERVER_FQDN="${SERVER_FQDN:-}"
if [[ -z "$PANEL_HOST" || -z "$SERVER_FQDN" ]]; then
  if [[ -f "$QADBAK_DIR/.env.local" ]]; then
    # shellcheck disable=SC1091
    source <(grep -E '^(QADBAK_PUBLIC_HOST|PANEL_HOST)=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
    PANEL_HOST="${PANEL_HOST:-${QADBAK_PUBLIC_HOST:-}}"
  fi
  SERVER_FQDN="${SERVER_FQDN:-$(hostname -f 2>/dev/null || hostname)}"
  PANEL_HOST="${PANEL_HOST:-$SERVER_FQDN}"
fi

APACHE_BACKEND="$(bash "$QADBAK_DIR/scripts/detect-apache-backend.sh")"
echo "==> Apache backend for hosted sites: $APACHE_BACKEND"
echo "==> Panel hostname (Qadbak UI): $PANEL_HOST"

NGX="/etc/nginx/sites-available/qadbak"
sed -e "s/__PANEL_HOST__/$PANEL_HOST/g" \
  -e "s/__SERVER_FQDN__/$SERVER_FQDN/g" \
  -e "s|__APACHE_BACKEND__|$APACHE_BACKEND|g" \
  "$QADBAK_DIR/deploy/nginx-qadbak.conf" >"$NGX"
ln -sf "$NGX" /etc/nginx/sites-enabled/qadbak
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl reload nginx

echo ""
echo "Done."
echo "  Customer domains (e.g. siccamanagement.nl) → Apache at $APACHE_BACKEND"
echo "  Qadbak panel → https://$PANEL_HOST/  (and :11000 if enabled)"
echo "  Test site:  curl -sI -H 'Host: YOUR_DOMAIN' http://127.0.0.1/ | head -3"
