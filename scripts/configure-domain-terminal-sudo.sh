#!/usr/bin/env bash
# Allow Qadbak to spawn domain shells for the native terminal (no server admin).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-terminal-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
GEN="$LIB_DIR/generate-sudoers-domain-users.sh"
RUNNER="$(readlink -f "$QADBAK_DIR/scripts/run-domain-terminal.sh")"
if [[ ! -f "$RUNNER" ]]; then
  echo "Missing $RUNNER — git pull first." >&2
  exit 1
fi
chmod 755 "$RUNNER" "$GEN" "$LIB_DIR/list-sudo-unix-users.sh"

SUDOERS="/etc/sudoers.d/qadbak-domain-terminal"
bash "$GEN" "$QADBAK_USER" "$RUNNER" \
  "# Qadbak domain terminal — per unix-user sudo (re-run after new domains)" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "OK — $QADBAK_USER may run: sudo -n $RUNNER <unix-user> (registered users only)"
