#!/usr/bin/env bash
# Apply PHP-FPM pools + nginx vhosts for all native domains.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-all-php-fpm-pools.sh" >&2
  exit 1
fi

REG="$QADBAK_DIR/data/native-domains.json"
if [[ ! -f "$REG" ]]; then
  echo "No $REG — nothing to do." >&2
  exit 0
fi

php_version_for_domain() {
  local domain="$1"
  local cfg="$QADBAK_DIR/data/domain-config/${domain}/php.json"
  [[ -f "$cfg" ]] || return 0
  if command -v jq &>/dev/null; then
    jq -r '.defaultVersion // empty' "$cfg" 2>/dev/null | head -1
    return 0
  fi
  node -e "
    const fs=require('fs');
    const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
    process.stdout.write(String(j.defaultVersion||''));
  " "$cfg" 2>/dev/null || true
}

list_domain_users() {
  if command -v jq &>/dev/null; then
    jq -r '.[] | select(.name and .user and (.demoOnly != true)) | [.name,.user] | @tsv' "$REG" 2>/dev/null
    return 0
  fi
  node -e "
    const rows=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
    for (const r of rows) {
      if (r && r.name && r.user && !r.demoOnly) console.log(r.name+'\t'+r.user);
    }
  " "$REG"
}

count=0
while IFS=$'\t' read -r domain user; do
  [[ -z "$domain" || -z "$user" ]] && continue
  if ! id "$user" &>/dev/null; then
    echo "    SKIP $domain — unix user $user does not exist" >&2
    continue
  fi
  ver="$(php_version_for_domain "$domain")"
  echo "==> $domain ($user) PHP-FPM"
  bash "$QADBAK_DIR/scripts/apply-php-fpm-pool.sh" "$user" "${ver:-}" "/home/${user}" \
    || echo "    WARN: pool failed for $user" >&2
  bash "$QADBAK_DIR/scripts/apply-domain-nginx.sh" "$domain" "$user" \
    || echo "    WARN: nginx failed for $domain" >&2
  count=$((count + 1))
done < <(list_domain_users)

echo "Done — processed $count domain(s)."
