#!/usr/bin/env bash
# Allow Qadbak user to install panel.<domain> nginx vhosts via sudo.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-panel-vhost-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
GEN="$LIB_DIR/generate-sudoers-domain-names.sh"
SCRIPT="$(readlink -f "$QADBAK_DIR/scripts/apply-client-panel-vhost.sh")"
if [[ ! -f "$SCRIPT" ]]; then
  echo "Missing $SCRIPT — git pull in $QADBAK_DIR first." >&2
  exit 1
fi
chmod 755 "$SCRIPT" "$GEN"

SUDOERS="/etc/sudoers.d/qadbak-panel-vhost"
bash "$GEN" "$QADBAK_USER" "$SCRIPT" \
  "# Qadbak panel vhost — per-domain sudo (re-run after new domains)" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "==> Verify"
if ! sudo -u "$QADBAK_USER" sudo -n "$SCRIPT" __probe__ 2>/dev/null | grep -q OK; then
  echo "FAILED: sudo rule not active." >&2
  exit 1
fi
echo "OK — test: sudo -u $QADBAK_USER sudo -n $SCRIPT __probe__"
