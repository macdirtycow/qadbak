#!/usr/bin/env bash
# nginx: inveil.dev redirect only (apex vhost is qadbak-customer via website.json).
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/web-preflight.sh
source "$OPS_DIR/lib/web-preflight.sh"

APEX="${INVEIL_APEX:-inveil.net}"
DEV_HOST="${INVEIL_DEV_HOST:-inveil.dev}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${APEX}}"

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

web_preflight_ensure_nginx

issue_cert() {
  local n
  for n in "$@"; do
    [[ -f "/etc/letsencrypt/live/${n}/fullchain.pem" ]] && continue
    web_preflight_issue_cert "$n" "$CERTBOT_EMAIL" || return 1
  done
}

write_dev_vhost() {
  local conf="/etc/nginx/sites-available/${DEV_HOST}.conf"
  local cert="/etc/letsencrypt/live/${DEV_HOST}/fullchain.pem"
  issue_cert "$DEV_HOST" || true
  if [[ ! -f "$cert" ]]; then
    cat >"$conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DEV_HOST};
    return 301 http://${APEX}\$request_uri;
}
EOF
    ln -sf "$conf" "/etc/nginx/sites-enabled/${DEV_HOST}.conf"
    return 0
  fi
  cat >"$conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DEV_HOST};
    return 301 https://${APEX}\$request_uri;
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DEV_HOST};
    ssl_certificate     /etc/letsencrypt/live/${DEV_HOST}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DEV_HOST}/privkey.pem;
    return 301 https://${APEX}\$request_uri;
}
EOF
  ln -sf "$conf" "/etc/nginx/sites-enabled/${DEV_HOST}.conf"
}

write_dev_vhost

nginx -t
systemctl reload nginx

PUBLIC_IP="$(web_preflight_public_ipv4)"
echo ""
echo "OK — https://${DEV_HOST}/ → https://${APEX}/"
[[ -n "$PUBLIC_IP" ]] && web_preflight_check_dns "$DEV_HOST" "$PUBLIC_IP"
