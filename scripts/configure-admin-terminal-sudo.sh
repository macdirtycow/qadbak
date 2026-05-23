#!/usr/bin/env bash
# Allow Qadbak to spawn root bash for the admin panel terminal.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-admin-terminal-sudo.sh" >&2
  exit 1
fi

RUNNER="$(readlink -f "$QADBAK_DIR/scripts/run-admin-terminal.sh")"
chmod 755 "$RUNNER"

SUDOERS="/etc/sudoers.d/qadbak-admin-terminal"
cat >"$SUDOERS" <<EOF
# Qadbak admin terminal — root bash for panel administrators only (JWT-gated)
$QADBAK_USER ALL=(root) NOPASSWD: $RUNNER
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "OK — $QADBAK_USER may run: sudo -n $RUNNER"
