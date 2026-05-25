#!/usr/bin/env bash
# Validate the local license cache (CI / release audit). Open-core
# refactor removed the `data/premium/` artifact tree, so this now only
# checks that `data/license.json` looks healthy when present.
set -euo pipefail
ROOT="${QADBAK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
LICENSE="$ROOT/data/license.json"

if [[ ! -f "$LICENSE" ]]; then
  echo "OK: no license file (Core evaluation)"
  exit 0
fi

node -e "
const fs=require('fs');
const lic=JSON.parse(fs.readFileSync('$LICENSE','utf8'));
const ok=lic.token && lic.status !== 'revoked' && lic.status !== 'expired';
process.exit(ok?0:1);
" 2>/dev/null || {
  echo "FAIL: license file present but revoked/expired/malformed" >&2
  exit 1
}

echo "OK: licensed install"
