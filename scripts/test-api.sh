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

PROVISIONER="${QADBAK_PROVISIONER:-virtualmin}"
if [[ "$PROVISIONER" == "hybrid" || "$PROVISIONER" == "native" ]]; then
  echo "Provisioner=$PROVISIONER — testing native domain registry"
  exec bash "$ROOT/scripts/test-native-domains.sh"
fi

: "${VIRTUALMIN_URL:?Set VIRTUALMIN_URL in .env.local}"
: "${VIRTUALMIN_USER:?Set VIRTUALMIN_USER}"
: "${VIRTUALMIN_PASS:?Set VIRTUALMIN_PASS}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/virtualmin-domains.sh
source "$ROOT/scripts/lib/virtualmin-domains.sh" 2>/dev/null || true
# shellcheck source=lib/extract-virtualmin-domain.sh
source "$ROOT/scripts/lib/extract-virtualmin-domain.sh" 2>/dev/null || true

TEST_DOMAIN="${TEST_DOMAIN:-}"
if [[ -z "$TEST_DOMAIN" && -f "$ROOT/.env.local" ]]; then
  TEST_DOMAIN="$(grep -E '^TEST_DOMAIN=' "$ROOT/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'" || true)"
fi
if [[ -z "$TEST_DOMAIN" && -f "$ROOT/.env.local" ]]; then
  TEST_DOMAIN="$(grep -E '^QADBAK_TEST_SERVER=' "$ROOT/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'" || true)"
fi
if [[ -n "$TEST_DOMAIN" ]] && [[ ! "$TEST_DOMAIN" =~ \. ]]; then
  TEST_DOMAIN=""
fi
if [[ -z "$TEST_DOMAIN" ]]; then
  TEST_DOMAIN="$(first_virtualmin_domain 2>/dev/null || true)"
fi
if [[ -z "$TEST_DOMAIN" ]] && [[ "$(id -u)" -eq 0 ]] && command -v virtualmin &>/dev/null; then
  TEST_DOMAIN="$(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d' | grep -E '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' | head -1 || true)"
fi
LIST_DOMAINS_TMP=""
echo "Using TEST_DOMAIN=${TEST_DOMAIN:-<from list-domains>}"

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
  if [[ "$program" == "list-domains" ]] && ! grep -qE '"(domain|name|website_hostnames)"' "$tmp"; then
    rm -f "$tmp"
    echo "FAILED: $program (no domain data in response)" >&2
    FAILED=1
    return 1
  fi
  if [[ "$program" == "list-domains" ]]; then
    LIST_DOMAINS_TMP="$tmp"
    if [[ -z "$TEST_DOMAIN" ]]; then
      TEST_DOMAIN="$(extract_domain_from_vm_json "$tmp" 2>/dev/null || true)"
    fi
    tmp="" # keep file for optional calls
    if [[ -n "$TEST_DOMAIN" ]]; then
      echo "Resolved TEST_DOMAIN=$TEST_DOMAIN"
      echo ""
    fi
  fi
  [[ -n "$tmp" ]] && rm -f "$tmp"
  return 0
}

# Preflight only requires list-domains; other calls are informational.
if ! call_api "list-domains"; then
  exit 1
fi

if [[ -z "$TEST_DOMAIN" ]]; then
  echo "Set TEST_DOMAIN=your.domain or create a VirtualMin domain first." >&2
  [[ -n "$LIST_DOMAINS_TMP" ]] && rm -f "$LIST_DOMAINS_TMP"
  exit 1
fi

call_api "create-login-link" --data-urlencode "domain=${TEST_DOMAIN}" || true
call_api "list-users" --data-urlencode "domain=${TEST_DOMAIN}" || true
call_api "list-databases" --data-urlencode "domain=${TEST_DOMAIN}" || true

if [[ "$FAILED" -ne 0 ]]; then
  echo "Some optional API calls failed (see above)." >&2
fi

[[ -n "$LIST_DOMAINS_TMP" ]] && rm -f "$LIST_DOMAINS_TMP"
echo "OK — list-domains succeeded (required for preflight)."
