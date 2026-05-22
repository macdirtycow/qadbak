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
  sudo -u qadbak sudo -n "$WRAPPER" "$@" | tail -1
}

echo "==> provisioning-helper ping"
run ping | grep -q '"ok"' && echo "OK ping"

if has ssl; then
  echo "==> ssl-list $DOMAIN"
  run ssl-list "$DOMAIN" | grep -q '"ok"' && echo "OK ssl-list"
fi
if has dns; then
  echo "==> dns-get $DOMAIN"
  run dns-get "$DOMAIN" | grep -q '"ok"' && echo "OK dns-get"
fi
if has mail; then
  echo "==> mail-list $DOMAIN"
  run mail-list "$DOMAIN" | grep -q '"ok"' && echo "OK mail-list"
fi
if has db; then
  echo "==> db-list $DOMAIN"
  run db-list "$DOMAIN" | grep -q '"ok"' && echo "OK db-list"
fi
if has backup; then
  echo "==> backup-list $DOMAIN"
  run backup-list "$DOMAIN" | grep -q '"ok"' && echo "OK backup-list"
fi
if has cron; then
  echo "==> cron-list $DOMAIN"
  run cron-list "$DOMAIN" | grep -q '"ok"' && echo "OK cron-list"
fi

echo "Done native provisioning smoke tests."
