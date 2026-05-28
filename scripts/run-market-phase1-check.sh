#!/usr/bin/env bash
# Market phase 1 — verify native independent mode on this VPS.
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
cd "$ROOT"

echo "=== Market phase 1 — native production check ==="
fail=0

check() {
  if "$@"; then
    echo "  OK — $*"
  else
    echo "  FAIL — $*" >&2
    fail=1
  fi
}

check bash scripts/audit-vm-dependency.sh

if [[ -f .env.local ]]; then
  grep -qE '^QADBAK_PROVISIONER=native' .env.local && echo "  OK — QADBAK_PROVISIONER=native" || {
    echo "  WARN — set QADBAK_PROVISIONER=native" >&2
    fail=1
  }
  if grep -qE '^QADBAK_LEGACY_API_FALLBACK=(false|0|no)' .env.local; then
    echo "  OK — legacy API fallback disabled"
  else
    echo "  WARN — set QADBAK_LEGACY_API_FALLBACK=false" >&2
    fail=1
  fi
else
  echo "  FAIL — missing .env.local" >&2
  fail=1
fi

check node scripts/provisioning-helper.mjs ping

if command -v curl &>/dev/null; then
  health="$(curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || true)"
  if echo "$health" | grep -q '"provisioner":"native"'; then
    echo "  OK — panel health provisioner native"
  else
    echo "  WARN — panel health: $health" >&2
  fi
fi

if [[ -f data/native-domains.json ]]; then
  n="$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/native-domains.json','utf8')).length)")"
  echo "  OK — native-domains.json ($n domains)"
else
  echo "  WARN — no data/native-domains.json" >&2
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Phase 1 gate: PASS — safe to enable market phases 2–8 features."
  exit 0
fi
echo "Phase 1 gate: FAIL — fix items above before market rollout."
exit 1
