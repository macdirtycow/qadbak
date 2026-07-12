#!/usr/bin/env bash
# Passwordless stack helper for Qadbak admin (nginx/apache/firewall validate & reload).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-stack-helper-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
HELPER="$(readlink -f "$QADBAK_DIR/scripts/stack-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-stack-helper.sh")"
ALLOWLIST="$LIB_DIR/stack-helper-commands.txt"
GEN="$LIB_DIR/generate-sudoers-allowlist.sh"
WRITE="$LIB_DIR/write-wrapper-allowlist.sh"

if [[ ! -f "$HELPER" ]]; then
  echo "Missing helper — git pull first." >&2
  exit 1
fi

NODE_BIN="$(sudo -u "$QADBAK_USER" -H bash -lc 'command -v node' 2>/dev/null | head -1)"
[[ -z "$NODE_BIN" ]] && NODE_BIN="$(command -v node)"
NODE_BIN="$(readlink -f "$NODE_BIN")"

chmod 755 "$HELPER" "$GEN" "$WRITE"
bash "$WRITE" "$WRAPPER" "$ALLOWLIST" "$NODE_BIN" "$HELPER"

SUDOERS="/etc/sudoers.d/qadbak-stack-helper"
bash "$GEN" "$QADBAK_USER" "$WRAPPER" "$ALLOWLIST" \
  "# Qadbak stack config helper — per-command sudo" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

if ! sudo -u "$QADBAK_USER" sudo -n "$WRAPPER" ping 2>/dev/null | grep -q '"ok"'; then
  echo "FAILED: sudo rule not active." >&2
  exit 1
fi
echo "OK — wrapper: $WRAPPER"
