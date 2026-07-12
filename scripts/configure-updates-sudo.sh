#!/usr/bin/env bash
# Passwordless update helper for Qadbak admin (apt status / panel git update).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-updates-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
HELPER="$(readlink -f "$QADBAK_DIR/scripts/update-status-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-update-helper.sh")"
ALLOWLIST="$LIB_DIR/update-helper-commands.txt"
GEN="$LIB_DIR/generate-sudoers-allowlist.sh"
WRITE="$LIB_DIR/write-wrapper-allowlist.sh"

if [[ ! -f "$HELPER" ]]; then
  echo "Missing helper — git pull first." >&2
  exit 1
fi

chmod 755 "$HELPER" "$GEN" "$WRITE"
bash "$WRITE" "$WRAPPER" "$ALLOWLIST" "update-status-helper.mjs"

mkdir -p "$QADBAK_DIR/data/update-jobs" "$QADBAK_DIR/data/pre-update-backups"
chown -R "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/data/update-jobs" "$QADBAK_DIR/data/pre-update-backups" 2>/dev/null || true

SUDOERS="/etc/sudoers.d/qadbak-updates-helper"
bash "$GEN" "$QADBAK_USER" "$WRAPPER" "$ALLOWLIST" \
  "# Qadbak admin updates — per-command sudo" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

if ! sudo -u "$QADBAK_USER" sudo -n "$WRAPPER" ping 2>/dev/null | grep -q '"ok"'; then
  echo "FAILED: sudo rule not active." >&2
  exit 1
fi
echo "OK — wrapper: $WRAPPER"
