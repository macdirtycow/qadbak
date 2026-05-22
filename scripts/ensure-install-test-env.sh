#!/usr/bin/env bash
# Ensure .install-test.env exists for Playwright install E2E (updates without full reinstall).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.install-test.env"
LOCAL="$ROOT/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  exit 0
fi

if [[ -f "$LOCAL" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$LOCAL"
  set +a
fi

ADMIN_USER="${E2E_ADMIN_USER:-${QADBAK_E2E_ADMIN_USER:-admin}}"
ADMIN_PASS="${E2E_ADMIN_PASS:-${QADBAK_E2E_ADMIN_PASS:-}}"

if [[ -z "$ADMIN_PASS" ]]; then
  echo "No $ENV_FILE and no QADBAK_E2E_ADMIN_PASS in .env.local — skip install E2E" >&2
  echo "  Add QADBAK_E2E_ADMIN_PASS=... to .env.local or re-run install to create $ENV_FILE" >&2
  exit 1
fi

QADBAK_USER="${QADBAK_USER:-qadbak}"
umask 077
cat >"$ENV_FILE" <<EOF
E2E_ADMIN_USER=$ADMIN_USER
E2E_ADMIN_PASS=$ADMIN_PASS
EOF
if [[ "$(id -u)" -eq 0 ]]; then
  chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
echo "Created $ENV_FILE (from QADBAK_E2E_ADMIN_PASS)"
