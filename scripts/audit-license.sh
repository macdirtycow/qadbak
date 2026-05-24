#!/usr/bin/env bash
# Fail if premium files exist without a valid license (CI / release audit).
set -euo pipefail
ROOT="${QADBAK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
LICENSE="$ROOT/data/license.json"
PREMIUM="$ROOT/data/premium"

if [[ ! -d "$PREMIUM" ]]; then
  echo "OK: no premium directory"
  exit 0
fi

if [[ ! -f "$LICENSE" ]]; then
  echo "FAIL: data/premium present but no data/license.json" >&2
  exit 1
fi

STATUS=$(node -e "
const fs=require('fs');
const lic=JSON.parse(fs.readFileSync('$LICENSE','utf8'));
const ok=lic.token && lic.status !== 'revoked' && lic.status !== 'expired';
process.exit(ok?0:1);
" 2>/dev/null) || {
  echo "FAIL: invalid or expired license with premium artifacts" >&2
  exit 1
}

echo "OK: licensed premium install"
