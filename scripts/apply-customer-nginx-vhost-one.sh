#!/usr/bin/env bash
# Single-domain nginx vhost (native provisioning) — redirects + proxies aware.
set -euo pipefail
DOMAIN="${1:?domain}"
USER="${2:?unix-user}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
exec bash "$QADBAK_DIR/scripts/apply-domain-nginx.sh" "$DOMAIN" "$USER"
