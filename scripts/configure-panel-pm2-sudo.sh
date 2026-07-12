#!/usr/bin/env bash
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-panel-pm2-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
SCRIPT="$(readlink -f "$QADBAK_DIR/scripts/run-panel-pm2.sh")"
ALLOWLIST="$LIB_DIR/panel-pm2-commands.txt"
GEN="$LIB_DIR/generate-sudoers-allowlist.sh"
chmod 755 "$SCRIPT" "$GEN"

SUDOERS="/etc/sudoers.d/qadbak-panel-pm2"
bash "$GEN" "$QADBAK_USER" "$SCRIPT" "$ALLOWLIST" \
  "# Qadbak panel pm2 control — per-action sudo" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

sudo -u "$QADBAK_USER" sudo -n "$SCRIPT" __probe__ | grep -q OK
echo "OK — panel pm2 control ($(wc -l <"$ALLOWLIST" | tr -d ' ') rules)"

if [[ -f "$QADBAK_DIR/scripts/install-qadbak-systemd.sh" ]]; then
  bash "$QADBAK_DIR/scripts/install-qadbak-systemd.sh"
fi
