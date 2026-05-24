#!/usr/bin/env bash
# v1 preflight on a test VPS (run after install/qadbak-install.sh).
# Usage: sudo -u qadbak bash scripts/v1-test-preflight.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass() { echo "  OK   $1"; }
fail() { echo "  FAIL $1"; FAILED=1; }
warn() { echo "  WARN $1"; }

FAILED=0

echo "==> Qadbak v1 preflight ($ROOT)"
echo ""

if [[ -f scripts/lib/ubuntu-release.sh ]]; then
  # shellcheck source=lib/ubuntu-release.sh
  source scripts/lib/ubuntu-release.sh
  if qadbak_detect_ubuntu_release; then
    pass "$(qadbak_ubuntu_release_label)"
  else
    warn "OS not Ubuntu 22.04/24.04 — native stack may differ"
  fi
fi
echo ""

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
  pass ".env.local present"
else
  fail ".env.local missing (copy from .env.test-server.example)"
fi

if [[ "${QADBAK_PROVISIONER:-}" == "native" ]]; then
  pass "QADBAK_PROVISIONER=native"
elif [[ "${VIRTUALMIN_MOCK:-true}" == "true" ]]; then
  fail "VIRTUALMIN_MOCK=true — set false on test server or use QADBAK_PROVISIONER=native"
else
  pass "VIRTUALMIN_MOCK=false"
fi

if [[ -n "${SESSION_SECRET:-}" && "${#SESSION_SECRET}" -ge 16 ]]; then
  pass "SESSION_SECRET length"
else
  fail "SESSION_SECRET missing or too short"
fi

if [[ -f data/users.json ]]; then
  pass "data/users.json exists"
else
  fail "data/users.json missing"
fi

echo ""
echo "==> pm2"
if command -v pm2 &>/dev/null && pm2 describe qadbak &>/dev/null; then
  pass "pm2 process qadbak"
  pm2 describe qadbak 2>/dev/null | grep -E 'status|uptime' || true
else
  fail "pm2 process qadbak not running (pm2 start npm --name qadbak -- start)"
fi

echo ""
echo "==> HTTP (local)"
PORT="${PORT:-3000}"
CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/login" || echo 000)"
if [[ "$CODE" =~ ^(200|307|308)$ ]]; then
  pass "GET http://127.0.0.1:${PORT}/login → $CODE"
else
  fail "GET http://127.0.0.1:${PORT}/login → $CODE"
fi

echo ""
if [[ "${QADBAK_PROVISIONER:-}" == "hybrid" || "${QADBAK_PROVISIONER:-}" == "native" ]]; then
  echo "==> Native domains (phase 8)"
else
  echo "==> VirtualMin API"
fi
if bash scripts/test-api.sh >/tmp/qadbak-test-api.out 2>&1; then
  if [[ "${QADBAK_PROVISIONER:-}" == "hybrid" || "${QADBAK_PROVISIONER:-}" == "native" ]]; then
    if grep -qE 'native-domains\.json|native domain registry' /tmp/qadbak-test-api.out; then
      pass "native domain registry (phase 8)"
    else
      fail "test-native-domains — see /tmp/qadbak-test-api.out"
      tail -10 /tmp/qadbak-test-api.out 2>/dev/null || true
    fi
  elif grep -q 'list-domains' /tmp/qadbak-test-api.out; then
    pass "npm run test-api (list-domains)"
  else
    fail "test-api ran but no list-domains output"
  fi
else
  fail "npm run test-api — see /tmp/qadbak-test-api.out"
  tail -20 /tmp/qadbak-test-api.out 2>/dev/null || true
fi

echo ""
echo "==> Public panel host (optional)"
PANEL="${QADBAK_PUBLIC_HOST:-}"
if [[ -n "$PANEL" ]]; then
  PCODE="$(curl -sk -o /dev/null -w "%{http_code}" "https://${PANEL}/login" 2>/dev/null || echo 000)"
  if [[ "$PCODE" =~ ^(200|307|308)$ ]]; then
    pass "https://${PANEL}/login → $PCODE"
  else
    warn "https://${PANEL}/login → $PCODE (DNS/cert may still be pending)"
  fi
else
  warn "QADBAK_PUBLIC_HOST not set"
fi

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "Preflight passed. Continue with docs/V1-TEST-SERVER.md Steps 6–10 (E2E checklist)."
  exit 0
fi
echo "Preflight failed. Fix FAIL items before E2E testing."
exit 1
