#!/usr/bin/env bash
# Smoke-test mobile auth + Bearer domain API.
# Usage: npm run dev (or production panel), then: npm run test:mobile-auth

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE="${QADBAK_MOBILE_TEST_BASE:-http://127.0.0.1:3000}"
USER="${QADBAK_E2E_ADMIN_USER:-admin}"
PASS="${QADBAK_E2E_ADMIN_PASS:-changeme}"

echo "Mobile auth test against $BASE (user=$USER)"

login_json="$(curl -sf -X POST "$BASE/api/auth/mobile" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\",\"deviceLabel\":\"test-mobile-auth\"}")"

if echo "$login_json" | grep -q '"requiresTotp"'; then
  echo "SKIP: account requires TOTP — set QADBAK_E2E_ADMIN_PASS to a non-TOTP test user or disable TOTP." >&2
  exit 0
fi

ACCESS="$(echo "$login_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')"
REFRESH="$(echo "$login_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["refreshToken"])')"

echo "OK login — access token length ${#ACCESS}"

me="$(curl -sf "$BASE/api/mobile/v1/me" -H "Authorization: Bearer $ACCESS")"
echo "$me" | grep -q "\"username\"" || { echo "FAIL /api/mobile/v1/me" >&2; exit 1; }
echo "OK /api/mobile/v1/me"

domains="$(curl -sf "$BASE/api/domains" -H "Authorization: Bearer $ACCESS")"
echo "$domains" | grep -q '"domains"' || { echo "FAIL /api/domains" >&2; exit 1; }
echo "OK /api/domains (Bearer, no CSRF Origin)"

refresh_json="$(curl -sf -X POST "$BASE/api/auth/mobile/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")"
NEW_ACCESS="$(echo "$refresh_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')"
[[ "$NEW_ACCESS" != "$ACCESS" ]] || { echo "FAIL refresh did not rotate access token" >&2; exit 1; }
echo "OK /api/auth/mobile/refresh"

echo "All mobile auth checks passed."
