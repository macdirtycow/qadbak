#!/usr/bin/env bash
# List VirtualMin domains (API + CLI) — run on VPS as root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Qadbak test-api"
sudo -u qadbak bash -c "cd '$ROOT' && npm run test-api" 2>&1 | head -80

echo ""
echo "==> virtualmin CLI (if installed)"
if command -v virtualmin &>/dev/null; then
  virtualmin list-domains --name-only 2>/dev/null || virtualmin list-domains 2>/dev/null | head -20
else
  echo "virtualmin command not in PATH"
fi

echo ""
echo "==> Hostname (must not be a bare IP for create-domain)"
hostname -f
