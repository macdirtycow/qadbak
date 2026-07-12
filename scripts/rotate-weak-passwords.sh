#!/usr/bin/env bash
# Check panel users for default/weak passwords (changeme, etc.) and optionally rotate.
#
# Usage:
#   bash scripts/rotate-weak-passwords.sh                 # check only, exit 1 if weak found
#   sudo bash scripts/rotate-weak-passwords.sh --fix      # prompt for new passwords
#   sudo bash scripts/rotate-weak-passwords.sh --fix --generate
#   sudo bash scripts/rotate-weak-passwords.sh --fix --password 'YourSecurePass123!'
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_USER="${QADBAK_USER:-qadbak}"
USERS="$ROOT/data/users.json"

if [[ ! -f "$USERS" ]]; then
  echo "Missing $USERS" >&2
  exit 1
fi

run_node() {
  if [[ "$(id -u)" -eq 0 ]] && id "$QADBAK_USER" &>/dev/null; then
    sudo -u "$QADBAK_USER" env QADBAK_DIR="$ROOT" node "$ROOT/scripts/rotate-weak-passwords.mjs" "$@"
  else
    env QADBAK_DIR="$ROOT" node "$ROOT/scripts/rotate-weak-passwords.mjs" "$@"
  fi
}

run_node "$@"
code=$?

if [[ "$code" -eq 0 ]] && [[ "$(id -u)" -eq 0 ]] && [[ -f "$USERS" ]]; then
  chown "$QADBAK_USER:$QADBAK_USER" "$USERS"
  chmod 600 "$USERS"
fi

exit "$code"
