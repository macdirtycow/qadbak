#!/usr/bin/env bash
# Remove domain from Qadbak registry + nginx (keeps unix user).
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:?domain}"
sudo -u qadbak sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" domain-delete "$DOMAIN"
echo "OK — removed $DOMAIN from panel/nginx"
