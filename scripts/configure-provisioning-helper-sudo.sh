#!/usr/bin/env bash
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
HELPER="$(readlink -f "$QADBAK_DIR/scripts/provisioning-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-provisioning-helper.sh")"
ALLOWLIST="$LIB_DIR/provisioning-helper-commands.txt"
GEN="$LIB_DIR/generate-sudoers-allowlist.sh"
NODE_BIN="$(sudo -u "$QADBAK_USER" -H bash -lc 'command -v node' | head -1)"
[[ -z "$NODE_BIN" ]] && NODE_BIN="$(command -v node)"
NODE_BIN="$(readlink -f "$NODE_BIN")"

chmod 755 "$HELPER" "$GEN"
# Shell allowlist already enforced in run-provisioning-helper.sh (committed file).

SUDOERS="/etc/sudoers.d/qadbak-provisioning-helper"
bash "$GEN" "$QADBAK_USER" "$WRAPPER" "$ALLOWLIST" \
  "# Qadbak native provisioning — per-command sudo (no WRAPPER *)" \
  --wildcard-all >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

sudo -u "$QADBAK_USER" sudo -n "$WRAPPER" ping | grep -q '"ok"' || {
  echo "FAILED provisioning helper sudo" >&2
  exit 1
}
echo "OK — $WRAPPER ($(wc -l <"$ALLOWLIST" | tr -d ' ') sudo rules)"
echo "     node:    $NODE_BIN (runtime: command -v node)"
echo "     test:    sudo -u $QADBAK_USER sudo -n $WRAPPER ping"
