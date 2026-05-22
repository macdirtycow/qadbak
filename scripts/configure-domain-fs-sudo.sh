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
HELPER="$(readlink -f "$QADBAK_DIR/scripts/domain-fs-helper.mjs")"
if [[ ! -f "$HELPER" ]]; then
  echo "Missing $HELPER — git pull in $QADBAK_DIR first." >&2
  exit 1
fi

chmod 755 "$HELPER"
SUDOERS="/etc/sudoers.d/qadbak-domain-fs"
cat >"$SUDOERS" <<EOF
# Qadbak native file browser — list/read/write under /home/
$QADBAK_USER ALL=(root) NOPASSWD: $NODE_BIN $HELPER *
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "==> Verify file helper sudo"
if ! sudo -u "$QADBAK_USER" sudo -n "$NODE_BIN" "$HELPER" list /home 2>/dev/null | grep -q '"ok"'; then
  echo "WARN: file helper sudo test did not return ok JSON (may still work for domain paths)." >&2
else
  echo "OK — file helper sudo works."
fi

echo "Configured: $SUDOERS"
