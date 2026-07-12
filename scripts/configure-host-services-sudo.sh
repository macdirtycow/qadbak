#!/usr/bin/env bash
# Passwordless systemctl for allowlisted services (Qadbak admin phase 4).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-host-services-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
HELPER="$(readlink -f "$QADBAK_DIR/scripts/host-services-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-host-services-helper.sh")"
ALLOWLIST="$LIB_DIR/host-services-commands.txt"
GEN="$LIB_DIR/generate-sudoers-allowlist.sh"
WRITE="$LIB_DIR/write-wrapper-allowlist.sh"

if [[ ! -f "$HELPER" ]]; then
  echo "Missing $HELPER — git pull in $QADBAK_DIR first." >&2
  exit 1
fi

NODE_BIN="$(sudo -u "$QADBAK_USER" -H bash -lc 'command -v node' 2>/dev/null | head -1)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi
NODE_BIN="$(readlink -f "$NODE_BIN")"

chmod 755 "$HELPER" "$GEN" "$WRITE"
bash "$WRITE" "$WRAPPER" "$ALLOWLIST" "$NODE_BIN" "$HELPER"

SUDOERS="/etc/sudoers.d/qadbak-host-services"
bash "$GEN" "$QADBAK_USER" "$WRAPPER" "$ALLOWLIST" \
  "# Qadbak admin service control — per-command sudo" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "==> Verify host services helper"
if ! sudo -u "$QADBAK_USER" sudo -n "$WRAPPER" list 2>/dev/null | grep -q '"ok"'; then
  echo "FAILED: sudo rule not active." >&2
  exit 1
fi
echo "OK — wrapper: $WRAPPER"
