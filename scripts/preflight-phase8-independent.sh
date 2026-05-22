#!/usr/bin/env bash
# Checks before enabling phase 8 independent (no VirtualMin API fallback).
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
cd "$ROOT"
FAILED=0

pass() { echo "  OK   $1"; }
fail() { echo "  FAIL $1" >&2; FAILED=1; }

[[ -f "$ROOT/.env.local" ]] && set -a && source "$ROOT/.env.local" && set +a

echo "==> Phase 8 independent preflight"
echo ""

FEATURES="${QADBAK_NATIVE_FEATURES:-}"
for need in ssl dns mail db backup cron; do
  if echo "$FEATURES" | tr ',' '\n' | grep -qx "$need"; then
    pass "native feature: $need"
  else
    fail "missing QADBAK_NATIVE_FEATURES entry: $need (run apply-phase8-native-enable.sh)"
  fi
done

if [[ -f "$ROOT/data/native-domains.json" ]] && grep -q '"name"' "$ROOT/data/native-domains.json"; then
  pass "native-domains.json"
else
  fail "native-domains.json empty — run export-native-domains.sh"
fi

if sudo -u qadbak sudo -n "$ROOT/scripts/run-provisioning-helper.sh" ping 2>/dev/null | grep -q '"ok":true'; then
  pass "provisioning-helper sudo"
else
  fail "provisioning-helper ping"
fi

DOMAIN="${TEST_DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(grep -o '"name":"[^"]*"' "$ROOT/data/native-domains.json" 2>/dev/null | head -1 | sed 's/"name":"//;s/"//')"
fi
if [[ -n "$DOMAIN" ]]; then
  if sudo -u qadbak sudo -n "$ROOT/scripts/run-provisioning-helper.sh" dns-get "$DOMAIN" 2>/dev/null | grep -q '"ok":true'; then
    pass "dns-get $DOMAIN"
  else
    fail "dns-get $DOMAIN"
  fi
else
  fail "TEST_DOMAIN / native-domains.json domain"
fi

echo ""
if [[ "$FAILED" -ne 0 ]]; then
  echo "Fix failures before: sudo bash scripts/apply-phase8-independent.sh" >&2
  exit 1
fi
echo "OK — ready for independent mode (no remote.cgi fallback)"
