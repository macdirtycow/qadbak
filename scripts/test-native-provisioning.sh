#!/usr/bin/env bash
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${TEST_DOMAIN:-siccamanagement.nl}"
WRAPPER="$ROOT/scripts/run-provisioning-helper.sh"
FEATURES="${QADBAK_NATIVE_FEATURES:-}"

[[ -f "$ROOT/.env.local" ]] && source "$ROOT/.env.local"

has() { echo "$FEATURES" | tr ',' '\n' | grep -qx "$1"; }

run() {
  echo "  → $*"
  local out
  out="$(sudo -u qadbak sudo -n "$WRAPPER" "$@" 2>&1 | tail -1)"
  echo "$out"
  echo "$out" | grep -q '"ok":true'
}

FAILED=0
check() {
  if run "$@"; then
    echo "OK $1"
  else
    echo "FAIL $1" >&2
    FAILED=1
  fi
}

echo "==> provisioning-helper ping"
check ping

if has ssl; then
  echo "==> ssl-list $DOMAIN"
  check ssl-list "$DOMAIN"
fi
if has dns; then
  echo "==> dns-get $DOMAIN"
  check dns-get "$DOMAIN"
fi
if has mail; then
  echo "==> mail-list $DOMAIN"
  check mail-list "$DOMAIN"
fi
if has db; then
  echo "==> db-list $DOMAIN"
  check db-list "$DOMAIN"
fi
if has backup; then
  echo "==> backup-list $DOMAIN"
  check backup-list "$DOMAIN"
fi
if has cron; then
  echo "==> cron-list $DOMAIN"
  check cron-list "$DOMAIN"
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "Some native checks failed." >&2
  exit 1
fi

echo "Done native provisioning smoke tests."
