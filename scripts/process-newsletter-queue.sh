#!/usr/bin/env bash
# Process pending newsletter send queues for all customer domains.
# Recommended cron (as root): */5 * * * * /opt/qadbak/scripts/process-newsletter-queue.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"
HELPER="$QADBAK_DIR/scripts/provisioning-helper.mjs"
REG="$QADBAK_DIR/data/native-domains.json"
BATCH="${NEWSLETTER_BATCH_SIZE:-50}"
MAX_ROUNDS="${NEWSLETTER_MAX_ROUNDS:-20}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/process-newsletter-queue.sh" >&2
  exit 1
fi

if [[ ! -f "$REG" ]]; then
  exit 0
fi

mapfile -t DOMAINS < <(node -e "
  const fs=require('fs');
  const rows=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  for (const r of rows) if (r && r.name) console.log(r.name);
" "$REG" 2>/dev/null || true)

for domain in "${DOMAINS[@]}"; do
  [[ -z "$domain" ]] && continue
  queue="$QADBAK_DIR/data/domain-config/${domain,,}/newsletter-queue.jsonl"
  [[ -f "$queue" ]] || continue
  [[ -s "$queue" ]] || continue
  echo "==> Newsletter queue: $domain"
  for ((i=0; i<MAX_ROUNDS; i++)); do
    out="$(node "$HELPER" newsletter-send-batch "$domain" "$BATCH" 2>/dev/null | tail -1 || true)"
    [[ -z "$out" ]] && break
    remaining="$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(String(j.remaining??0))}catch{process.stdout.write('0')}" "$out")"
    [[ "$remaining" == "0" ]] && break
  done
done
