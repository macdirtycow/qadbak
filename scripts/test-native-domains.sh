#!/usr/bin/env bash
# Preflight domain list without VirtualMin remote API (phase 8 hybrid/native).
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
cd "$ROOT"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

REG="$ROOT/data/native-domains.json"
if [[ ! -f "$REG" ]]; then
  echo "FAIL: missing $REG — run: sudo bash scripts/export-native-domains.sh" >&2
  exit 1
fi

if ! grep -q '"name"' "$REG"; then
  echo "FAIL: $REG has no domains" >&2
  exit 1
fi

echo "=== native-domains.json ==="
head -20 "$REG"
echo ""
echo "OK — native domain registry ($(grep -c '"name"' "$REG" || echo 0) domain(s))"
