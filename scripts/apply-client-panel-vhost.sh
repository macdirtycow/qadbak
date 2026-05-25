#!/usr/bin/env bash
# Nginx vhost: panel.<domain> → Qadbak Next.js (:3000) and terminal WS (:3001).
# Usage: sudo bash scripts/apply-client-panel-vhost.sh example.com
#        sudo bash scripts/apply-client-panel-vhost.sh __probe__
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

if [[ "$DOMAIN" == "__probe__" ]]; then
  echo "OK"
  exit 0
fi

if [[ -z "$DOMAIN" ]] || [[ "$DOMAIN" == *"/"* ]] || [[ "$DOMAIN" == *" "* ]]; then
  echo "Usage: sudo bash scripts/apply-client-panel-vhost.sh <domain>" >&2
  exit 1
fi

DOMAIN="$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
PANEL_HOST="panel.${DOMAIN}"
SAFE="${DOMAIN//./-}"
OUT="/etc/nginx/sites-available/qadbak-panel-${SAFE}.conf"
ENABLED="/etc/nginx/sites-enabled/qadbak-panel-${SAFE}.conf"

LE_EMAIL=""
if [[ -f "$ROOT/.env.local" ]]; then
  LE_EMAIL="$(grep -E '^QADBAK_LE_EMAIL=' "$ROOT/.env.local" | cut -d= -f2- | tr -d '"' || true)"
  [[ -z "$LE_EMAIL" ]] && LE_EMAIL="$(grep -E '^LE_EMAIL=' "$ROOT/.env.local" | cut -d= -f2- | tr -d '"' || true)"
fi
if [[ -z "$LE_EMAIL" ]]; then
  LE_EMAIL="admin@${DOMAIN}"
fi

echo "==> DNS A record for ${PANEL_HOST}"
bash "$ROOT/scripts/ensure-panel-dns-a.sh" "$DOMAIN" || true

write_proxy_locations() {
  cat <<'NGX'
    location /ws/domain-terminal {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
NGX
}

cat >"$OUT" <<EOF
# Qadbak client panel — ${PANEL_HOST}
server {
    listen 80;
    listen [::]:80;
    server_name ${PANEL_HOST};

    client_max_body_size 100g;

$(write_proxy_locations)
}
EOF

ln -sf "$OUT" "$ENABLED"
nginx -t
systemctl reload nginx

if [[ -n "$LE_EMAIL" ]] && command -v certbot &>/dev/null; then
  if [[ ! -f "/etc/letsencrypt/live/${PANEL_HOST}/fullchain.pem" ]]; then
    echo "==> TLS for ${PANEL_HOST} (Let's Encrypt, ${LE_EMAIL})"
    if certbot --nginx -d "$PANEL_HOST" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect; then
      echo "OK — HTTPS enabled for ${PANEL_HOST}"
    else
      echo "WARN: certbot failed — use http://${PANEL_HOST}/ until DNS propagates, then re-run this script" >&2
    fi
  else
    echo "==> TLS cert already present for ${PANEL_HOST}"
    certbot --nginx -d "$PANEL_HOST" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect 2>/dev/null || true
  fi
else
  echo "NOTE: certbot not installed — panel.${DOMAIN} is HTTP only on port 80"
fi

nginx -t
systemctl reload nginx
echo "OK — https://${PANEL_HOST}/login (or http:// if no cert yet)"
