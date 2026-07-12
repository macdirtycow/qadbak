#!/usr/bin/env bash
# Per-domain sudoers lines for scripts taking a domain as first arg.
# Usage: generate-sudoers-domain-names.sh USER SCRIPT HEADER
set -euo pipefail
USER="${1:?user}"
SCRIPT="${2:?script path}"
HEADER="${3:-# Qadbak per-domain sudo (generated)}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
REG="$QADBAK_DIR/data/native-domains.json"

echo "$HEADER"
printf '%s ALL=(root) NOPASSWD: %s __probe__\n' "$USER" "$SCRIPT"
if [[ -f "$REG" ]]; then
  node -e "
const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
if(!Array.isArray(rows)) process.exit(0);
const seen=new Set();
for (const r of rows) {
  const d=String(r?.name||'').trim();
  if(!d || r.demoOnly===true || seen.has(d)) continue;
  seen.add(d);
  console.log(d);
}
" "$REG" 2>/dev/null | while IFS= read -r domain; do
    [[ -n "$domain" ]] || continue
    printf '%s ALL=(root) NOPASSWD: %s %s\n' "$USER" "$SCRIPT" "$domain"
  done
fi
