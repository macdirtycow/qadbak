#!/usr/bin/env bash
# Allow Qadbak to spawn domain shells for the native terminal (no Webmin).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-terminal-sudo.sh" >&2
  exit 1
fi

RUNNER="$(readlink -f "$QADBAK_DIR/scripts/run-domain-terminal.sh")"
if [[ ! -f "$RUNNER" ]]; then
  echo "Missing $RUNNER — git pull first." >&2
  exit 1
fi
chmod 755 "$RUNNER"

SUDOERS="/etc/sudoers.d/qadbak-domain-terminal"
cat >"$SUDOERS" <<EOF
# Qadbak native terminal — bash as domain unix users under /home/
$QADBAK_USER ALL=(root) NOPASSWD: $RUNNER *
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "OK — $QADBAK_USER may run: sudo -n $RUNNER <unix-user>"
