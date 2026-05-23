#!/usr/bin/env bash
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${TEST_DOMAIN:-siccamanagement.nl}"
WRAPPER="$ROOT/scripts/run-provisioning-helper.sh"

[[ -f "$ROOT/.env.local" ]] && source "$ROOT/.env.local"
FEATURES="${QADBAK_NATIVE_FEATURES:-}"

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
if has aliases; then
  echo "==> alias-list $DOMAIN"
  check alias-list "$DOMAIN"
fi
if has redirects; then
  echo "==> redirect-list $DOMAIN"
  check redirect-list "$DOMAIN"
fi
if has features; then
  echo "==> feature-list $DOMAIN"
  check feature-list "$DOMAIN"
fi
if has logs; then
  echo "==> logs-tail $DOMAIN"
  check logs-tail "$DOMAIN" error
fi
if has php; then
  echo "==> php-versions $DOMAIN"
  check php-versions "$DOMAIN"
  check php-directories "$DOMAIN"
fi
if has ftp; then
  echo "==> ftp-list $DOMAIN"
  check ftp-list "$DOMAIN"
fi
if has limits; then
  echo "==> limits-get $DOMAIN"
  check limits-get "$DOMAIN"
fi
if has lifecycle; then
  echo "==> domain-enable $DOMAIN"
  check domain-enable "$DOMAIN"
fi
if has mail-settings; then
  echo "==> mail-settings-get $DOMAIN"
  check mail-settings-get "$DOMAIN"
fi
if has lifecycle; then
  check domain-validate "$DOMAIN"
fi
if has mail-logs; then
  check mail-logs-search "$DOMAIN" "$DOMAIN"
fi
if has imap; then
  IMAP_USER="${TEST_MAIL_USER:-}"
  check imap-list "$DOMAIN" "$IMAP_USER"
  if [[ -n "$IMAP_USER" ]]; then
    check imap-messages "$DOMAIN" "$IMAP_USER" INBOX
  fi
fi
if has protected; then
  check protected-list "$DOMAIN"
fi
if has shared; then
  check shared-list "$DOMAIN"
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "Some native checks failed." >&2
  exit 1
fi

echo "Done native provisioning smoke tests."
