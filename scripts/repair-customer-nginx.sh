#!/usr/bin/env bash
# Remove broken qadbak-customer-* symlinks and rebuild all customer vhosts.
# Run after git pull if nginx -t fails on qadbak-customer-example.com.conf (dangling symlink).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

# shellcheck source=lib/nginx-customer-vhost.sh
source "$QADBAK_DIR/scripts/lib/nginx-customer-vhost.sh"

echo "==> Remove old customer nginx configs (including broken symlinks)"
nginx_customer_conf_remove_all

# Legacy dotted filenames from older releases
rm -f /etc/nginx/sites-available/qadbak-customer-*.com.conf \
  /etc/nginx/sites-available/qadbak-customer-*.dev.conf \
  /etc/nginx/sites-available/qadbak-customer-*.nl.conf 2>/dev/null || true
shopt -s nullglob
for f in /etc/nginx/sites-enabled/qadbak-customer-*.*.conf; do
  rm -f "$f"
done
shopt -u nullglob

bash "$QADBAK_DIR/scripts/apply-customer-nginx-vhosts.sh"

echo ""
echo "Repair done. Test: curl -sI -H 'Host: example.com' http://127.0.0.1/ | head -5"
