#!/usr/bin/env bash
# Allow Qadbak to run website repair (Apache + firewall) via sudo.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-repair-sudo.sh" >&2
  exit 1
fi

SCRIPT="$QADBAK_DIR/scripts/fix-domain-website.sh"
if [[ ! -f "$SCRIPT" ]]; then
  echo "Missing $SCRIPT — git pull first." >&2
  exit 1
fi
chmod 755 "$SCRIPT"

SUDOERS="/etc/sudoers.d/qadbak-domain-repair"
cat >"$SUDOERS" <<EOF
# Qadbak website repair (Cloudflare 523 / Apache down)
$QADBAK_USER ALL=(root) NOPASSWD: /bin/bash $SCRIPT
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"
echo "OK — $QADBAK_USER can run fix-domain-website.sh via sudo."
