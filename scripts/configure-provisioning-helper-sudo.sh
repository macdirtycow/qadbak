#!/usr/bin/env bash
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

HELPER="$(readlink -f "$QADBAK_DIR/scripts/provisioning-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-provisioning-helper.sh")"
NODE_BIN="$(sudo -u "$QADBAK_USER" -H bash -lc 'command -v node' | head -1)"
[[ -z "$NODE_BIN" ]] && NODE_BIN="$(command -v node)"
NODE_BIN="$(readlink -f "$NODE_BIN")"

chmod 755 "$HELPER" "$WRAPPER"
grep -q '^QADBAK_NODE_BIN=' "$WRAPPER" && \
  sed -i "s|^QADBAK_NODE_BIN=.*|QADBAK_NODE_BIN=$NODE_BIN|" "$WRAPPER" || true

cat >"/etc/sudoers.d/qadbak-provisioning-helper" <<EOF
# Qadbak native provisioning (phase 8)
$QADBAK_USER ALL=(root) NOPASSWD: $WRAPPER *
EOF
chmod 440 "/etc/sudoers.d/qadbak-provisioning-helper"
visudo -cf "/etc/sudoers.d/qadbak-provisioning-helper"

sudo -u "$QADBAK_USER" sudo -n "$WRAPPER" ping | grep -q '"ok"' || {
  echo "FAILED provisioning helper sudo" >&2
  exit 1
}
echo "OK — $WRAPPER"
