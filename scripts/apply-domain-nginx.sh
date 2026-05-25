#!/usr/bin/env bash
# Rebuild customer nginx vhost (redirects + reverse proxies from domain-config).
# PHP: per-user PHP-FPM socket when pool exists, else Apache backend proxy.
# HTTPS: enabled when /etc/letsencrypt/live/DOMAIN exists (or after ISSUE_SSL=1 certbot).
set -euo pipefail
DOMAIN="${1:?domain}"
USER="${2:?unix-user}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
APACHE_BACKEND="${APACHE_BACKEND:-127.0.0.1:8080}"
PUB="/home/${USER}/public_html"
REDIR_JSON="$QADBAK_DIR/data/domain-config/${DOMAIN}/redirects.json"
PROXY_JSON="$QADBAK_DIR/data/domain-config/${DOMAIN}/proxies.json"

# shellcheck source=lib/php-fpm-pool.sh
source "$QADBAK_DIR/scripts/lib/php-fpm-pool.sh"
# shellcheck source=lib/nginx-customer-vhost.sh
source "$QADBAK_DIR/scripts/lib/nginx-customer-vhost.sh"

[[ -d "$PUB" ]] || mkdir -p "$PUB" && chown -R "${USER}:${USER}" "/home/${USER}"

PHP_VER="$(php_fpm_domain_version "$DOMAIN" "$QADBAK_DIR")"
PHP_VER="$(php_fpm_detect_version "$PHP_VER")"
if [[ -f "$QADBAK_DIR/scripts/apply-php-fpm-pool.sh" ]]; then
  bash "$QADBAK_DIR/scripts/apply-php-fpm-pool.sh" "$USER" "$PHP_VER" "/home/${USER}" 2>/dev/null || true
fi

if [[ "${ISSUE_SSL:-}" == "1" ]] && command -v certbot &>/dev/null; then
  if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    LE_EMAIL="${QADBAK_LE_EMAIL:-${LE_EMAIL:-admin@${DOMAIN}}}"
    echo "==> TLS: certbot webroot for $DOMAIN"
    certbot certonly --webroot -w "$PUB" -d "$DOMAIN" -d "www.${DOMAIN}" \
      --non-interactive --agree-tos -m "$LE_EMAIL" --keep-until-expiring \
      2>/dev/null || certbot certonly --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
      --non-interactive --agree-tos -m "$LE_EMAIL" --keep-until-expiring 2>/dev/null || true
  fi
fi

SSL_CERT_HOST=""
for candidate in "$DOMAIN" "www.${DOMAIN}"; do
  if [[ -f "/etc/letsencrypt/live/${candidate}/fullchain.pem" ]]; then
    SSL_CERT_HOST="$candidate"
    break
  fi
done

write_site_server() {
  local listen_ssl="$1"
  local cert_host="${2:-}"

  echo "server {"
  if [[ "$listen_ssl" == "1" ]]; then
    echo "    listen 443 ssl http2;"
    echo "    listen [::]:443 ssl http2;"
    echo "    server_name ${DOMAIN} www.${DOMAIN};"
    echo "    ssl_certificate     /etc/letsencrypt/live/${cert_host}/fullchain.pem;"
    echo "    ssl_certificate_key /etc/letsencrypt/live/${cert_host}/privkey.pem;"
  else
    echo "    listen 80;"
    echo "    listen [::]:80;"
    echo "    server_name ${DOMAIN} www.${DOMAIN};"
  fi
  echo "    root ${PUB};"
  echo "    index index.html index.htm index.php;"
  echo "    client_max_body_size 100g;"

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
  nginx_php_location_lines "$USER" "$APACHE_BACKEND"
  echo "}"
}

OUT="$(nginx_customer_conf_available "$DOMAIN")"
ENABLED_LINK="$(nginx_customer_conf_enabled "$DOMAIN")"
{
  echo "# Qadbak — ${DOMAIN} (user ${USER}, PHP ${PHP_VER})"
  if [[ -n "$SSL_CERT_HOST" ]]; then
    write_site_server 1 "$SSL_CERT_HOST"
    echo ""
    echo "server {"
    echo "    listen 80;"
    echo "    listen [::]:80;"
    echo "    server_name ${DOMAIN} www.${DOMAIN};"
    echo "    return 301 https://\$host\$request_uri;"
    echo "}"
  else
    write_site_server 0 ""
  fi
} >"$OUT"

ln -sf "$OUT" "$ENABLED_LINK"
if [[ "${NGINX_BATCH:-}" != "1" ]]; then
  nginx -t
  systemctl reload nginx
fi
if php_fpm_pool_available "$USER"; then
  echo "OK — nginx vhost ${DOMAIN} (PHP-FPM unix:$(php_fpm_socket_path "$USER")${SSL_CERT_HOST:+, HTTPS})"
else
  echo "OK — nginx vhost ${DOMAIN} (PHP → Apache ${APACHE_BACKEND}${SSL_CERT_HOST:+, HTTPS})"
fi
