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

is_ip() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

PANEL_HOST="${PANEL_HOST:-}"
SERVER_FQDN="${SERVER_FQDN:-}"
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(QADBAK_PUBLIC_HOST|PANEL_HOST)=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
  PANEL_HOST="${PANEL_HOST:-${QADBAK_PUBLIC_HOST:-}}"
fi
SERVER_FQDN="${SERVER_FQDN:-$(hostname -f 2>/dev/null || hostname)}"
PANEL_HOST="${PANEL_HOST:-$SERVER_FQDN}"

if is_ip "$PANEL_HOST"; then
  echo "WARN: QADBAK_PUBLIC_HOST is a bare IP ($PANEL_HOST) — using server FQDN $SERVER_FQDN for nginx." >&2
  echo "       Set QADBAK_PUBLIC_HOST=$SERVER_FQDN in .env.local (TLS and mail need a hostname)." >&2
  PANEL_HOST="$SERVER_FQDN"
fi

SSL_CERT_HOST=""
for candidate in "$PANEL_HOST" "$SERVER_FQDN"; do
  if [[ -f "/etc/letsencrypt/live/$candidate/fullchain.pem" ]]; then
    SSL_CERT_HOST="$candidate"
    break
  fi
done

APACHE_BACKEND="$(bash "$QADBAK_DIR/scripts/detect-apache-backend.sh")"
echo "==> Apache backend for hosted sites: $APACHE_BACKEND"
echo "==> Panel hostname (Qadbak UI): $PANEL_HOST"
if [[ -n "$SSL_CERT_HOST" ]]; then
  echo "==> TLS certificate: /etc/letsencrypt/live/$SSL_CERT_HOST/"
  NGX_SRC="$QADBAK_DIR/deploy/nginx-qadbak.conf"
else
  echo "==> No Let's Encrypt cert for panel — HTTP only on port 80 (use :11000 for panel HTTPS via Cloudflare or add certbot)"
  NGX_SRC="$QADBAK_DIR/deploy/nginx-qadbak-http.conf"
fi

NGX="/etc/nginx/sites-available/qadbak"
sed -e "s/__PANEL_HOST__/$PANEL_HOST/g" \
  -e "s/__SERVER_FQDN__/$SERVER_FQDN/g" \
  -e "s/__SSL_CERT_HOST__/${SSL_CERT_HOST:-$SERVER_FQDN}/g" \
  -e "s|__APACHE_BACKEND__|$APACHE_BACKEND|g" \
  "$NGX_SRC" >"$NGX"
ln -sf "$NGX" /etc/nginx/sites-enabled/qadbak
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl reload nginx

if is_ip "$(grep -E '^QADBAK_PUBLIC_HOST=' "$QADBAK_DIR/.env.local" 2>/dev/null | cut -d= -f2- || true)"; then
  sed -i "s/^QADBAK_PUBLIC_HOST=.*/QADBAK_PUBLIC_HOST=$SERVER_FQDN/" "$QADBAK_DIR/.env.local" 2>/dev/null || true
  chown qadbak:qadbak "$QADBAK_DIR/.env.local" 2>/dev/null || true
  echo "    Updated QADBAK_PUBLIC_HOST in .env.local → $SERVER_FQDN"
fi

echo ""
echo "Done."
echo "  Customer domains (e.g. siccamanagement.nl) → Apache at $APACHE_BACKEND"
if [[ -n "$SSL_CERT_HOST" ]]; then
  echo "  Qadbak panel → https://$PANEL_HOST/login  (and :11000 if enabled)"
else
  echo "  Qadbak panel → http://$SERVER_FQDN/  or http://YOUR_IP:11000/login"
fi
echo "  Test site:  curl -sI -H 'Host: siccamanagement.nl' http://127.0.0.1/ | head -3"
