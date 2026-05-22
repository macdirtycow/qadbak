#!/usr/bin/env bash
# Single-domain nginx vhost (native provisioning).
set -euo pipefail
DOMAIN="${1:?domain}"
USER="${2:?unix-user}"
APACHE_BACKEND="${APACHE_BACKEND:-127.0.0.1:8080}"
PUB="/home/${USER}/public_html"
[[ -d "$PUB" ]] || mkdir -p "$PUB" && chown -R "${USER}:${USER}" "/home/${USER}"

OUT="/etc/nginx/sites-available/qadbak-customer-${DOMAIN}.conf"
cat >"$OUT" <<NGX
# Qadbak native — ${DOMAIN}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${PUB};
    index index.html index.htm index.php;
    location / { try_files \$uri \$uri/ =404; }
    location ~ \\.php(/|\$) {
        proxy_pass http://${APACHE_BACKEND};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGX
ln -sf "$OUT" "/etc/nginx/sites-enabled/qadbak-customer-${DOMAIN}.conf"
nginx -t
systemctl reload nginx
