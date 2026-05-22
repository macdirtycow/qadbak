#!/usr/bin/env bash
# Install sudoers rule for Qadbak native file manager (existing servers).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-fs-sudo.sh" >&2
  exit 1
fi

NODE_BIN="$(command -v node)"
HELPER="$QADBAK_DIR/scripts/domain-fs-helper.mjs"
if [[ ! -f "$HELPER" ]]; then
  echo "Missing $HELPER — git pull in $QADBAK_DIR first." >&2
  exit 1
fi

chmod 755 "$HELPER"
SUDOERS="/etc/sudoers.d/qadbak-domain-fs"
cat >"$SUDOERS" <<EOF
# Qadbak native file browser — list/read/write under /home/
$QADBAK_USER ALL=(root) NOPASSWD: $NODE_BIN $HELPER
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"
echo "OK — $QADBAK_USER can run domain-fs-helper.mjs via sudo."
