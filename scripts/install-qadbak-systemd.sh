#!/usr/bin/env bash
# Install systemd unit so `systemctl restart qadbak` works (wraps pm2).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
TEMPLATE="$QADBAK_DIR/deploy/qadbak.service"
TARGET="/etc/systemd/system/qadbak.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/install-qadbak-systemd.sh" >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing $TEMPLATE" >&2
  exit 1
fi

chmod 755 "$QADBAK_DIR/scripts/qadbak-service.sh"

sed \
  -e "s|/opt/qadbak|$QADBAK_DIR|g" \
  -e "s|QADBAK_USER=qadbak|QADBAK_USER=$QADBAK_USER|g" \
  "$TEMPLATE" >"$TARGET"
chmod 644 "$TARGET"

systemctl daemon-reload
systemctl enable qadbak.service
echo "OK — installed $TARGET"
echo "    systemctl restart qadbak"
echo "    systemctl status qadbak"
