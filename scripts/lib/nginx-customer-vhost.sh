#!/usr/bin/env bash
# Shared paths for per-domain customer nginx configs (dots → underscores in filenames).
set -euo pipefail

nginx_customer_conf_slug() {
  local domain="${1:?domain}"
  echo "${domain//./_}"
}

nginx_customer_conf_available() {
  local domain="${1:?domain}"
  local slug
  slug="$(nginx_customer_conf_slug "$domain")"
  echo "/etc/nginx/sites-available/qadbak-customer-${slug}.conf"
}

nginx_customer_conf_enabled() {
  local domain="${1:?domain}"
  local slug
  slug="$(nginx_customer_conf_slug "$domain")"
  echo "/etc/nginx/sites-enabled/qadbak-customer-${slug}.conf"
}

nginx_customer_conf_remove() {
  local domain="${1:?domain}"
  rm -f "$(nginx_customer_conf_available "$domain")" \
    "$(nginx_customer_conf_enabled "$domain")" 2>/dev/null || true
}

nginx_customer_conf_remove_all() {
  local dir avail enabled
  avail="/etc/nginx/sites-available"
  enabled="/etc/nginx/sites-enabled"
  rm -f "${avail}"/qadbak-customer-*.conf 2>/dev/null || true
  # Remove symlinks even when dangling (broken target).
  shopt -s nullglob
  for link in "${enabled}"/qadbak-customer-*.conf; do
    rm -f "$link"
  done
  shopt -u nullglob
}
