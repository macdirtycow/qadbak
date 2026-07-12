#!/usr/bin/env bash
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-panel-pm2-sudo.sh" >&2
  exit 1
fi

SCRIPT="$(readlink -f "$QADBAK_DIR/scripts/run-panel-pm2.sh")"
chmod 755 "$SCRIPT"

SUDOERS="/etc/sudoers.d/qadbak-panel-pm2"
cat >"$SUDOERS" <<EOF
# Qadbak panel pm2 control (admin dashboard)
$QADBAK_USER ALL=(root) NOPASSWD: $SCRIPT *
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

sudo -u "$QADBAK_USER" sudo -n "$SCRIPT" __probe__ | grep -q OK
echo "OK — panel pm2 control"

if [[ -f "$QADBAK_DIR/scripts/install-qadbak-systemd.sh" ]]; then
  bash "$QADBAK_DIR/scripts/install-qadbak-systemd.sh"
fi
