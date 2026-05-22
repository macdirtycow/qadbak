#!/usr/bin/env bash
# Create hosting account + nginx vhost (native, no VirtualMin API).
# Usage: sudo bash scripts/qadbak-add-domain.sh DOMAIN [UNIX_USER] [PASSWORD]
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:?domain}"
PASS="${3:-}"
USER="${2:-${DOMAIN%%.*}}"
NODE="$(command -v node)"
sudo -u qadbak sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" domain-create "$DOMAIN" "$PASS" "$USER"
echo "OK — $DOMAIN (user $USER)"
