#!/usr/bin/env bash
# Write/update .install-test.env for Playwright (panel admin password).
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
ENV_FILE="$ROOT/.install-test.env"
LOCAL="$ROOT/.env.local"
PASS_FILE="$ROOT/data/e2e-admin.pass"
QADBAK_USER="${QADBAK_USER:-qadbak}"

ADMIN_USER="admin"
ADMIN_PASS=""

if [[ -f "$LOCAL" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$LOCAL"
  set +a
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
  ADMIN_USER="${E2E_ADMIN_USER:-$ADMIN_USER}"
  ADMIN_PASS="${E2E_ADMIN_PASS:-}"
fi

ADMIN_USER="${E2E_ADMIN_USER:-${QADBAK_E2E_ADMIN_USER:-$ADMIN_USER}}"
ADMIN_PASS="${ADMIN_PASS:-${E2E_ADMIN_PASS:-${QADBAK_E2E_ADMIN_PASS:-}}}"

if [[ -z "$ADMIN_PASS" && -f "$PASS_FILE" ]]; then
  ADMIN_PASS="$(head -1 "$PASS_FILE" | tr -d '\r')"
fi

ADMIN_PASS="${ADMIN_PASS//$'\r'/}"

if [[ -z "$ADMIN_PASS" ]]; then
  echo "E2E password not configured." >&2
  echo "  Add to $LOCAL:" >&2
  echo "    QADBAK_E2E_ADMIN_PASS=your-panel-login-password" >&2
  echo "  Or create $ENV_FILE with E2E_ADMIN_PASS=..." >&2
  echo "  Or one line in $PASS_FILE (chmod 600, chown qadbak)" >&2
  exit 1
fi

umask 077
cat >"$ENV_FILE" <<EOF
E2E_ADMIN_USER=$ADMIN_USER
E2E_ADMIN_PASS=$ADMIN_PASS
EOF
if [[ "$(id -u)" -eq 0 ]]; then
  chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
echo "OK — $ENV_FILE updated (user: $ADMIN_USER)"
