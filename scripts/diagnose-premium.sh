#!/usr/bin/env bash
# Quick Premium / license diagnostics on the VPS.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
cd "$QADBAK_DIR"

echo "==> .env.local license vars"
grep -E '^QADBAK_LICENSE_|^QADBAK_PREMIUM_' .env.local 2>/dev/null || echo "    (none)"

echo "==> data/license.json"
if [[ -f data/license.json ]]; then
  node -e "
const l=require('./data/license.json');
console.log('  plan:', l.plan, 'status:', l.status);
console.log('  features:', (l.features||[]).join(', ')||'(none)');
console.log('  artifactVersion:', l.artifactVersion||'(none)');
"
else
  echo "    MISSING — activate license first"
fi

echo "==> data/premium/"
if [[ -d data/premium ]]; then
  ls -la data/premium/
  if [[ -f data/premium/active.json ]]; then
    echo "  active.json:"; cat data/premium/active.json
  else
    echo "    MISSING active.json — run Refresh modules / sync-premium-artifact.mjs"
  fi
else
  echo "    MISSING — Premium bundle never synced"
fi

echo "==> License server artifact (local :8787)"
VER="$(node -e "try{console.log(require('./data/license.json').artifactVersion||'0.1.0')}catch{console.log('0.1.0')}" 2>/dev/null)"
ART="/opt/qadbak-premium/license-server/data/artifacts/${VER}/premium.tar.gz"
[[ -f "$ART" ]] && echo "  OK $ART" || echo "  MISSING $ART — cd /opt/qadbak-premium && npm run build:release"

echo "==> CLI sync test (dry — only if licensed)"
if [[ -f data/license.json ]]; then
  sudo -u qadbak bash -c "set -a; source .env.local; set +a; node scripts/qadbak-license-cli.mjs status" 2>/dev/null | head -c 400
  echo ""
fi
