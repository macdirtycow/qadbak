#!/usr/bin/env bash
# Test VirtualMin Remote API connectivity (Phase 0).
# Usage: cp .env.example .env.local && edit credentials, then: npm run test-api

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
elif [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${VIRTUALMIN_URL:?Set VIRTUALMIN_URL in .env.local}"
: "${VIRTUALMIN_USER:?Set VIRTUALMIN_USER}"
: "${VIRTUALMIN_PASS:?Set VIRTUALMIN_PASS}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/virtualmin-domains.sh
source "$ROOT/scripts/lib/virtualmin-domains.sh" 2>/dev/null || true
TEST_DOMAIN="${TEST_DOMAIN:-}"
if [[ -z "$TEST_DOMAIN" ]]; then
  TEST_DOMAIN="$(first_virtualmin_domain 2>/dev/null || true)"
fi
if [[ -z "$TEST_DOMAIN" ]]; then
  echo "Set TEST_DOMAIN=your.domain or create a VirtualMin domain first." >&2
  exit 1
fi
echo "Using TEST_DOMAIN=$TEST_DOMAIN"

FAILED=0

call_api() {
  local program="$1"
  shift
  echo "=== $program ==="
  local -a extra=()
  if [[ "$program" == list-* ]]; then
    extra=(--data-urlencode "json=1" --data-urlencode "multiline=")
  elif [[ "$program" == "create-login-link" ]]; then
    extra=()
  else
    extra=(--data-urlencode "json=1" --data-urlencode "simple-multiline=")
  fi
  local tmp
  tmp="$(mktemp)"
  # Do not pipe curl to head — pipefail treats SIGPIPE as failure even when data arrived.
  if ! curl -sk \
    -u "${VIRTUALMIN_USER}:${VIRTUALMIN_PASS}" \
    -X POST \
    --data-urlencode "program=${program}" \
    "${extra[@]}" \
    "$@" \
    "${VIRTUALMIN_URL}" \
    -o "$tmp"; then
    rm -f "$tmp"
    echo "FAILED: $program (curl error)" >&2
    FAILED=1
    return 1
  fi
  head -c 4000 "$tmp"
  echo ""
  echo ""
  if [[ "$program" == "list-domains" ]] && ! grep -qE '"(domain|name)"' "$tmp"; then
    rm -f "$tmp"
    echo "FAILED: $program (no domain data in response)" >&2
    FAILED=1
    return 1
  fi
  rm -f "$tmp"
  return 0
}

# Preflight only requires list-domains; other calls are informational.
if ! call_api "list-domains"; then
  exit 1
fi

call_api "create-login-link" --data-urlencode "domain=${TEST_DOMAIN}" || true
call_api "list-users" --data-urlencode "domain=${TEST_DOMAIN}" || true
call_api "list-databases" --data-urlencode "domain=${TEST_DOMAIN}" || true

if [[ "$FAILED" -ne 0 ]]; then
  echo "Some optional API calls failed (see above)." >&2
fi

echo "OK — list-domains succeeded (required for preflight)."
