#!/usr/bin/env bash
# Rebuild customer nginx vhost (redirects + reverse proxies from domain-config).
set -euo pipefail
DOMAIN="${1:?domain}"
USER="${2:?unix-user}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
APACHE_BACKEND="${APACHE_BACKEND:-127.0.0.1:8080}"
PUB="/home/${USER}/public_html"
REDIR_JSON="$QADBAK_DIR/data/domain-config/${DOMAIN}/redirects.json"
PROXY_JSON="$QADBAK_DIR/data/domain-config/${DOMAIN}/proxies.json"

[[ -d "$PUB" ]] || mkdir -p "$PUB" && chown -R "${USER}:${USER}" "/home/${USER}"

OUT="/etc/nginx/sites-available/qadbak-customer-${DOMAIN}.conf"
{
  echo "# Qadbak native — ${DOMAIN}"
  echo "server {"
  echo "    listen 80;"
  echo "    listen [::]:80;"
  echo "    server_name ${DOMAIN} www.${DOMAIN};"
  echo "    root ${PUB};"
  echo "    index index.html index.htm index.php;"

  if [[ -f "$PROXY_JSON" ]] && command -v jq &>/dev/null; then
    while IFS=$'\t' read -r ppath pdest; do
      [[ -z "$ppath" || -z "$pdest" ]] && continue
      loc="${ppath%/}/"
      echo "    location ${loc} {"
      echo "        proxy_pass ${pdest};"
      echo "        proxy_http_version 1.1;"
      echo "        proxy_set_header Host \$host;"
      echo "        proxy_set_header X-Real-IP \$remote_addr;"
      echo "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
      echo "        proxy_set_header X-Forwarded-Proto \$scheme;"
      echo "    }"
    done < <(jq -r '.[] | [.path,.dest] | @tsv' "$PROXY_JSON" 2>/dev/null)
  fi

  if [[ -f "$REDIR_JSON" ]] && command -v jq &>/dev/null; then
    while IFS=$'\t' read -r rpath rdest rtype; do
      [[ -z "$rpath" ]] && continue
      code="${rtype:-301}"
      [[ "$code" == "302" ]] && code=302 || code=301
      echo "    location = ${rpath} { return ${code} \"${rdest}\"; }"
    done < <(jq -r '.[] | [.path,.dest,.type] | @tsv' "$REDIR_JSON" 2>/dev/null)
  fi

  echo "    location / { try_files \$uri \$uri/ =404; }"
  echo "    location ~ \\.php(/|\$) {"
  echo "        proxy_pass http://${APACHE_BACKEND};"
  echo "        proxy_http_version 1.1;"
  echo "        proxy_set_header Host \$host;"
  echo "        proxy_set_header X-Real-IP \$remote_addr;"
  echo "    }"
  echo "}"
} >"$OUT"

ln -sf "$OUT" "/etc/nginx/sites-enabled/qadbak-customer-${DOMAIN}.conf"
nginx -t
systemctl reload nginx
echo "OK — nginx vhost ${DOMAIN}"
