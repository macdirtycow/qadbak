#!/usr/bin/env bash
# Remove duplicate nginx server_name entries (e.g. inveil.net static site vs qadbak-customer).
# Usage: sudo bash scripts/repair-nginx-conflicts.sh [prefer.conf-basename]
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
PREFER="${1:-}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 [inveil.net.conf]" >&2
  exit 1
}

# shellcheck source=lib/list-customer-domains.sh
source "$QADBAK_DIR/scripts/lib/list-customer-domains.sh"
# shellcheck source=lib/nginx-customer-vhost.sh
source "$QADBAK_DIR/scripts/lib/nginx-customer-vhost.sh"

REG="$QADBAK_DIR/data/native-domains.json"
if [[ -f "$REG" ]]; then
  while IFS=$'\t' read -r domain _user; do
    [[ -z "$domain" ]] && continue
    if _should_skip_nginx_customer_domain "$domain"; then
      nginx_customer_conf_remove "$domain"
      echo "==> Removed qadbak-customer vhost for $domain (operator/static nginx owns it)"
    fi
  done < <(
    if command -v jq &>/dev/null; then
      jq -r '.[] | select(.name) | [.name,.user] | @tsv' "$REG" 2>/dev/null
    else
      node -e "
        const rows=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
        for (const r of rows) if (r?.name) console.log((r.name||'')+'\t'+(r.user||''));
      " "$REG"
    fi
  )
fi

if [[ -f "$QADBAK_DIR/scripts/dedupe-nginx-vhosts.sh" ]]; then
  if [[ -n "$PREFER" ]]; then
    bash "$QADBAK_DIR/scripts/dedupe-nginx-vhosts.sh" --apply --prefer="$PREFER"
  else
    bash "$QADBAK_DIR/scripts/dedupe-nginx-vhosts.sh" --apply
  fi
else
  nginx -t
  systemctl reload nginx
fi

echo "OK — nginx conflicts repaired"
