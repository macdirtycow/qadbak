#!/usr/bin/env bash
# List customer domains as TSV: domain<TAB>unix_user
# Sources: data/native-domains.json, VirtualMin, /home/*/.qadbak-domain markers.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"

_is_valid_domain() {
  [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]
}

_resolve_user_for_domain() {
  local domain="$1"
  local user=""
  if command -v virtualmin &>/dev/null; then
    user="$(virtualmin list-domains --domain "$domain" --multiline 2>/dev/null | awk -F': *' '/^Unix username:/ {print $2; exit}')"
  fi
  if [[ -z "$user" ]]; then
    user="${domain%%.*}"
  fi
  echo "$user"
}

_should_skip_nginx_customer_domain() {
  local domain="$1"
  local panel="${QADBAK_PUBLIC_HOST:-}"
  [[ -n "$panel" && "$domain" == "$panel" ]] && return 0
  [[ -n "$panel" && "$domain" == "www.${panel}" ]] && return 0
  [[ "$domain" == "license.omiiba.dev" ]] && return 0
  if [[ "$domain" == "omiiba.dev" || "$domain" == "www.omiiba.dev" ]]; then
    [[ -f /var/www/omiiba.dev/index.html || -f /etc/nginx/sites-enabled/omiiba.dev.conf ]] && return 0
  fi
  return 1
}

_emit_row() {
  local domain="$1" user="$2"
  [[ -z "$domain" || -z "$user" ]] && return 0
  _is_valid_domain "$domain" || return 0
  _should_skip_nginx_customer_domain "$domain" && return 0
  printf '%s\t%s\n' "$domain" "$user"
}

list_customer_domains_tsv() {
  declare -A SEEN=()

  if [[ -f "$QADBAK_DIR/.env.local" ]]; then
    # shellcheck disable=SC1091
    source <(grep -E '^QADBAK_PUBLIC_HOST=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
  fi
  local panel="${QADBAK_PUBLIC_HOST:-}"

  local reg="$QADBAK_DIR/data/native-domains.json"
  if [[ -f "$reg" ]]; then
    if command -v jq &>/dev/null; then
      while IFS=$'\t' read -r domain user; do
        [[ -z "$domain" || -z "$user" ]] && continue
        [[ -n "${SEEN[$domain]:-}" ]] && continue
        SEEN[$domain]=1
        _emit_row "$domain" "$user"
      done < <(jq -r '.[] | select(.name and .user) | [.name,.user] | @tsv' "$reg" 2>/dev/null)
    else
      while IFS=$'\t' read -r domain user; do
        [[ -z "$domain" || -z "$user" ]] && continue
        [[ -n "${SEEN[$domain]:-}" ]] && continue
        SEEN[$domain]=1
        _emit_row "$domain" "$user"
      done < <(node -e "
        const fs=require('fs');
        const rows=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
        for (const r of rows) {
          if (r && r.name && r.user) console.log(r.name+'\t'+r.user);
        }
      " "$reg" 2>/dev/null || true)
    fi
  fi

  if command -v virtualmin &>/dev/null; then
    local d
    while read -r d; do
      [[ -z "$d" ]] && continue
      [[ -n "${SEEN[$d]:-}" ]] && continue
      SEEN[$d]=1
      _emit_row "$d" "$(_resolve_user_for_domain "$d")"
    done < <(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d')
  fi

  local hint domain user home
  for hint in /home/*/.qadbak-domain; do
    [[ -f "$hint" ]] || continue
    domain="$(tr -d '\r\n' <"$hint" | head -1)"
    [[ -z "$domain" ]] && continue
    [[ -n "${SEEN[$domain]:-}" ]] && continue
    home="$(dirname "$hint")"
    user="$(basename "$home")"
    SEEN[$domain]=1
    _emit_row "$domain" "$user"
  done
}
