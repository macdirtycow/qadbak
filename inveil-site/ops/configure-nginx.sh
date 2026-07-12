#!/usr/bin/env bash
# nginx: inveil.net + www + inveil.dev redirect (main VPS)
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/web-preflight.sh
source "$OPS_DIR/lib/web-preflight.sh"

APEX="${INVEIL_APEX:-inveil.net}"
DEV_HOST="${INVEIL_DEV_HOST:-inveil.dev}"
WEB_ROOT="${INVEIL_WEB_ROOT:-/var/www/inveil.net}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${APEX}}"

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

mkdir -p "$WEB_ROOT"
web_preflight_ensure_nginx

issue_cert() {
  local n
  for n in "$@"; do
    [[ -f "/etc/letsencrypt/live/${n}/fullchain.pem" ]] && continue
    web_preflight_issue_cert "$n" "$CERTBOT_EMAIL" || return 1
  done
}

write_apex_vhost() {
  local conf="/etc/nginx/sites-available/${APEX}.conf"
  local cert="/etc/letsencrypt/live/${APEX}/fullchain.pem"
  issue_cert "$APEX" "www.${APEX}" || true
  if [[ ! -f "$cert" ]]; then
    cat >"$conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${APEX} www.${APEX};
    root ${WEB_ROOT};
    index index.html;
    location / { try_files \$uri \$uri/ =404; }
}
EOF
    ln -sf "$conf" "/etc/nginx/sites-enabled/${APEX}.conf"
    echo "WARN: ${APEX} served over HTTP until TLS is issued" >&2
    return 0
  fi
  cat >"$conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${APEX} www.${APEX};
    return 301 https://${APEX}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.${APEX};
    ssl_certificate     /etc/letsencrypt/live/${APEX}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APEX}/privkey.pem;
    return 301 https://${APEX}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${APEX};

    ssl_certificate     /etc/letsencrypt/live/${APEX}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APEX}/privkey.pem;

    root ${WEB_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \.(css|js|svg|png|jpg|webp|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
  ln -sf "$conf" "/etc/nginx/sites-enabled/${APEX}.conf"
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

write_apex_vhost
write_dev_vhost

nginx -t
systemctl reload nginx

PUBLIC_IP="$(web_preflight_public_ipv4)"
echo ""
echo "OK — https://${APEX}/ from ${WEB_ROOT}"
echo "OK — https://${DEV_HOST}/ → https://${APEX}/ (301 redirect)"
[[ -n "$PUBLIC_IP" ]] && web_preflight_check_dns "$DEV_HOST" "$PUBLIC_IP"
