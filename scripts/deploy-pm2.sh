#!/usr/bin/env bash
# Build and start Qadbak/Qadbak with pm2 (run from repo root).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local — copy from .env.example" >&2
  exit 1
fi

npm install
npm run build

if pm2 describe nexmin &>/dev/null; then
  pm2 delete nexmin
fi
if pm2 describe qadbak &>/dev/null; then
  pm2 restart qadbak
else
  pm2 start npm --name qadbak -- start
fi
pm2 save
echo "Qadbak running. Check: pm2 logs qadbak"
echo "Local: http://127.0.0.1:${PORT:-3000}/login"
