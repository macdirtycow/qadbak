#!/usr/bin/env bash
# Restart Qadbak with .env.local loaded into pm2 (fixes empty domain list in UI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER="${QADBAK_USER:-qadbak}"

run() {
  if [[ "$(id -un)" == "$USER" ]]; then
    bash -c "$1"
  else
    sudo -u "$USER" bash -c "$1"
  fi
}

if [[ ! -f "$ROOT/.env.local" ]]; then
  echo "Missing $ROOT/.env.local" >&2
  exit 1
fi

grep -q '^VIRTUALMIN_TLS_INSECURE=' "$ROOT/.env.local" || {
  echo 'VIRTUALMIN_TLS_INSECURE=true' >>"$ROOT/.env.local"
  chown "$USER:$USER" "$ROOT/.env.local" 2>/dev/null || true
}

echo "==> pm2 restart with ecosystem (.env.local → process env)"
run "cd '$ROOT' && pm2 delete qadbak 2>/dev/null || true"
run "cd '$ROOT' && pm2 start ecosystem.config.cjs"
run "cd '$ROOT' && pm2 save"

echo "==> Quick API check"
sleep 2
curl -sf "http://127.0.0.1:3000/api/health" | head -c 120 || true
echo ""
echo "Done. Open Domains in the panel (not New domain for siccamanagement.nl — it already exists)."
