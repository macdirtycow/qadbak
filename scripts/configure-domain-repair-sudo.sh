#!/usr/bin/env bash
# Allow Qadbak to run website repair (Apache + firewall) via sudo.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-repair-sudo.sh" >&2
  exit 1
fi

SCRIPT="$(readlink -f "$QADBAK_DIR/scripts/fix-domain-website.sh")"
if [[ ! -f "$SCRIPT" ]]; then
  echo "Missing $SCRIPT — git pull in $QADBAK_DIR first." >&2
  exit 1
fi
chmod 755 "$SCRIPT"

SUDOERS="/etc/sudoers.d/qadbak-domain-repair"
# Trailing * allows arguments (__probe__, domain name). Do not use /bin/bash wrapper.
cat >"$SUDOERS" <<EOF
# Qadbak website repair (Cloudflare 523 / Apache down)
$QADBAK_USER ALL=(root) NOPASSWD: $SCRIPT *
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "==> Verify (must print OK, no password prompt)"
if ! sudo -u "$QADBAK_USER" sudo -n "$SCRIPT" __probe__ 2>/dev/null | grep -q OK; then
  echo "FAILED: sudo rule not active. Check:" >&2
  echo "  cat $SUDOERS" >&2
  echo "  sudo -u $QADBAK_USER sudo -l" >&2
  exit 1
fi

echo "OK — test with:"
echo "  sudo -u $QADBAK_USER sudo -n $SCRIPT __probe__"
