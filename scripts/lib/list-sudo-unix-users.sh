#!/usr/bin/env bash
# List unix users allowed for per-user sudo rules (native-domains.json + /home).
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
REG="$QADBAK_DIR/data/native-domains.json"
declare -A SEEN=()
if [[ -f "$REG" ]]; then
  while IFS= read -r user; do
    [[ -n "$user" ]] || continue
    SEEN["$user"]=1
  done < <(node -e "
const fs=require('fs');
const p=process.argv[1];
try {
  const rows=JSON.parse(fs.readFileSync(p,'utf8'));
  if(!Array.isArray(rows)) process.exit(0);
  for (const r of rows) {
    if (r && r.user && r.demoOnly !== true) console.log(String(r.user).trim());
  }
} catch { process.exit(0); }
" "$REG" 2>/dev/null || true)
fi
for home in /home/*/; do
  [[ -d "$home/public_html" ]] || continue
  user="$(basename "$home")"
  case "$user" in syslog|www-data|backup|list|irc|gnats|nobody|qadbak) continue ;; esac
  SEEN["$user"]=1
done
for user in "${!SEEN[@]}"; do
  echo "$user"
done | sort -u
