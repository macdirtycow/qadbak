#!/usr/bin/env bash
# Merge legacy sites-available/DOMAIN.conf into Qadbak's single qadbak-customer vhost.
# Usage: sudo bash scripts/migrate-legacy-domain-nginx.sh [domain]
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
TARGET="${1:-}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 [domain]" >&2
  exit 1
}

# shellcheck source=lib/nginx-customer-vhost.sh
source "$QADBAK_DIR/scripts/lib/nginx-customer-vhost.sh"

migrate_one() {
  local domain="$1" user="$2"
  local legacy="/etc/nginx/sites-available/${domain}.conf"
  local legacy_enabled="/etc/nginx/sites-enabled/${domain}.conf"

  [[ -f "$legacy" || -L "$legacy_enabled" ]] || return 0

  local root mode www_redirect
  root="$(grep -E '^\s*root\s+' "$legacy" 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';' || true)"
  mode="php"
  www_redirect="none"
  if [[ -n "$root" ]] && grep -q 'try_files \$uri \$uri/ =404' "$legacy" 2>/dev/null \
    && ! grep -q '\.php' "$legacy" 2>/dev/null; then
    mode="static"
    www_redirect="apex"
  fi
  [[ -n "$root" ]] || root="/home/${user}/public_html"

  echo "==> Migrate $domain: legacy nginx → website.json + qadbak-customer vhost"
  migrate_args=(--webRoot "$root" --mode "$mode" --wwwRedirect "$www_redirect")
  if [[ "$mode" == "static" ]]; then
    migrate_args+=(--cacheStaticAssets)
  fi
  node "$QADBAK_DIR/scripts/lib/write-website-config.mjs" "$domain" "${migrate_args[@]}"

  rm -f "$legacy" "$legacy_enabled" 2>/dev/null || true
  bash "$QADBAK_DIR/scripts/apply-domain-nginx.sh" "$domain" "$user"
}

if [[ -n "$TARGET" ]]; then
  user="$(jq -r --arg d "$TARGET" '.[] | select(.name==$d) | .user' "$QADBAK_DIR/data/native-domains.json" 2>/dev/null | head -1)"
  [[ -n "$user" ]] || user="${TARGET%%.*}"
  migrate_one "$TARGET" "$user"
else
  while IFS=$'\t' read -r domain user; do
    [[ -z "$domain" || -z "$user" ]] && continue
    migrate_one "$domain" "$user"
  done < <(
    jq -r '.[] | select(.name and .user) | [.name,.user] | @tsv' \
      "$QADBAK_DIR/data/native-domains.json" 2>/dev/null
  )
fi

nginx -t
systemctl reload nginx
echo "OK — legacy domain nginx merged into Qadbak customer vhosts"
