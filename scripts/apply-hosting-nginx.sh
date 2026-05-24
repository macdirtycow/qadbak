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

if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(QADBAK_PROVISIONER|QADBAK_NATIVE_INSTALL|QADBAK_DISABLE_WEBMIN)=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
fi
if [[ "${QADBAK_DISABLE_WEBMIN:-}" == "1" || "${QADBAK_DISABLE_WEBMIN:-}" == "true" ]] || [[ "${QADBAK_PROVISIONER:-}" == "native" ]]; then
  export QADBAK_NATIVE_INSTALL=1
fi

# shellcheck source=lib/virtualmin-domains.sh
source "$ROOT/scripts/lib/virtualmin-domains.sh" 2>/dev/null || true
DETECT_DOMAIN="${DETECT_DOMAIN:-$(first_panel_domain 2>/dev/null || true)}"
if [[ -z "$DETECT_DOMAIN" ]]; then
  echo "WARN: No domain in data/native-domains.json — set DETECT_DOMAIN=your.domain" >&2
  DETECT_DOMAIN="localhost"
fi
APACHE_BACKEND="$(DETECT_DOMAIN="$DETECT_DOMAIN" bash "$QADBAK_DIR/scripts/detect-web-backend.sh" 2>/dev/null | tail -1)"
echo "==> Web backend for hosted sites (probe Host: $DETECT_DOMAIN): $APACHE_BACKEND"
PROBE_CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: $DETECT_DOMAIN" "http://$APACHE_BACKEND/" 2>/dev/null || echo 000)"
if [[ "$PROBE_CODE" == "502" || "$PROBE_CODE" == "000" ]]; then
  echo "WARN: backend $APACHE_BACKEND returned HTTP $PROBE_CODE — site may show Cloudflare 502." >&2
  echo "       Run: sudo bash scripts/fix-origin-502.sh $DETECT_DOMAIN" >&2
fi
echo "==> Panel hostname (Qadbak UI): $PANEL_HOST"
if [[ -n "$SSL_CERT_HOST" ]]; then
  echo "==> TLS certificate: /etc/letsencrypt/live/$SSL_CERT_HOST/"
  NGX_SRC="$QADBAK_DIR/deploy/nginx-qadbak.conf"
else
  echo "==> No Let's Encrypt cert for panel — HTTP only on port 80 (use :11000 for panel HTTPS via Cloudflare or add certbot)"
  NGX_SRC="$QADBAK_DIR/deploy/nginx-qadbak-http.conf"
fi

if [[ "$PANEL_HOST" == "$SERVER_FQDN" ]]; then
  PANEL_HTTP_NAMES="${PANEL_HOST} www.${PANEL_HOST}"
  PANEL_TLS_NAMES="$PANEL_HOST"
else
  PANEL_HTTP_NAMES="${PANEL_HOST} www.${PANEL_HOST} ${SERVER_FQDN}"
  PANEL_TLS_NAMES="${PANEL_HOST} ${SERVER_FQDN}"
fi

NGX="/etc/nginx/sites-available/qadbak"
sed -e "s/__PANEL_HOST__/$PANEL_HOST/g" \
  -e "s/__SERVER_FQDN__/$SERVER_FQDN/g" \
  -e "s/__PANEL_HTTP_NAMES__/$PANEL_HTTP_NAMES/g" \
  -e "s/__PANEL_TLS_NAMES__/$PANEL_TLS_NAMES/g" \
  -e "s/__SSL_CERT_HOST__/${SSL_CERT_HOST:-$SERVER_FQDN}/g" \
  -e "s|__APACHE_BACKEND__|$APACHE_BACKEND|g" \
  "$NGX_SRC" >"$NGX"
ln -sf "$NGX" /etc/nginx/sites-enabled/qadbak
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

if [[ -f "$QADBAK_DIR/scripts/dedupe-nginx-panel-vhosts.sh" ]]; then
  bash "$QADBAK_DIR/scripts/dedupe-nginx-panel-vhosts.sh" "$PANEL_HOST"
fi

nginx -t
systemctl reload nginx

for panel_conf in /etc/nginx/sites-available/qadbak-port-*; do
  [[ -f "$panel_conf" ]] || continue
  panel_port="${panel_conf##*qadbak-port-}"
  echo "==> Refresh panel port :$panel_port (Qadbak panel vhost)"
  QADBAK_NGINX_ONLY=1 bash "$QADBAK_DIR/scripts/enable-panel-port.sh" "$panel_port"
done

if [[ -f "$QADBAK_DIR/scripts/apply-customer-nginx-vhosts.sh" ]] && command -v virtualmin &>/dev/null && [[ "${QADBAK_NATIVE_INSTALL:-}" != "1" ]]; then
  echo ""
  APACHE_BACKEND="$APACHE_BACKEND" bash "$QADBAK_DIR/scripts/apply-customer-nginx-vhosts.sh"
fi

if is_ip "$(grep -E '^QADBAK_PUBLIC_HOST=' "$QADBAK_DIR/.env.local" 2>/dev/null | cut -d= -f2- || true)"; then
  sed -i "s/^QADBAK_PUBLIC_HOST=.*/QADBAK_PUBLIC_HOST=$SERVER_FQDN/" "$QADBAK_DIR/.env.local" 2>/dev/null || true
  chown qadbak:qadbak "$QADBAK_DIR/.env.local" 2>/dev/null || true
  echo "    Updated QADBAK_PUBLIC_HOST in .env.local → $SERVER_FQDN"
fi

echo ""
echo "Done."
if [[ "${QADBAK_NATIVE_INSTALL:-}" == "1" ]]; then
  echo "  Native domains → public_html nginx vhosts (PHP-FPM when pools applied) + Apache $APACHE_BACKEND"
else
  echo "  Customer domains → public_html nginx vhosts + Apache $APACHE_BACKEND"
fi
if [[ -n "$SSL_CERT_HOST" ]]; then
  echo "  Qadbak panel → https://$PANEL_HOST/login  (and :11000 if enabled)"
else
  echo "  Qadbak panel → http://$SERVER_FQDN/  or http://YOUR_IP:11000/login"
fi
echo "  Test site:  curl -sI -H 'Host: YOUR_DOMAIN' http://127.0.0.1/ | head -3"
