#!/usr/bin/env bash
# Nginx vhost per customer domain → public_html (native + legacy hosting API).
# More specific server_name wins over Qadbak default_server on port 80/443.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-customer-nginx-vhosts.sh" >&2
  exit 1
fi

# shellcheck source=lib/list-customer-domains.sh
source "$QADBAK_DIR/scripts/lib/list-customer-domains.sh"
# shellcheck source=lib/nginx-customer-vhost.sh
source "$QADBAK_DIR/scripts/lib/nginx-customer-vhost.sh"

APACHE_BACKEND="${APACHE_BACKEND:-127.0.0.1:8080}"
if [[ -f "$QADBAK_DIR/scripts/detect-web-backend.sh" ]]; then
  APACHE_BACKEND="$(bash "$QADBAK_DIR/scripts/detect-web-backend.sh" 2>/dev/null | tail -1)"
fi
export APACHE_BACKEND

nginx_customer_conf_remove_all

mapfile -t ROWS < <(list_customer_domains_tsv | sort -u)
if [[ ${#ROWS[@]} -eq 0 ]]; then
  echo "No customer domains found (native-domains.json, legacy hosting API, or /home/*/.qadbak-domain)." >&2
  exit 1
fi

echo "==> Customer nginx vhosts (${#ROWS[@]} domain(s), PHP → $APACHE_BACKEND)"
count=0
export NGINX_BATCH=1
for row in "${ROWS[@]}"; do
  domain="${row%%$'\t'*}"
  user="${row#*$'\t'}"
  [[ -z "$domain" || -z "$user" ]] && continue
  if ! id "$user" &>/dev/null; then
    echo "    SKIP $domain — unix user $user does not exist"
    continue
  fi
  PUB="/home/$user/public_html"
  if [[ ! -d "$PUB" ]]; then
    echo "    SKIP $domain — no $PUB" >&2
    continue
  fi
  if bash "$QADBAK_DIR/scripts/apply-domain-nginx.sh" "$domain" "$user"; then
    count=$((count + 1))
    echo "    $domain → $PUB ($(basename "$(nginx_customer_conf_enabled "$domain")"))"
  else
    echo "    WARN $domain — nginx config write failed" >&2
    nginx_customer_conf_remove "$domain"
  fi
done
unset NGINX_BATCH

nginx -t
systemctl reload nginx

echo "Done. Configured $count domain(s)."
echo "Test: curl -sI -H 'Host: YOUR_DOMAIN' http://127.0.0.1/ | head -3"
