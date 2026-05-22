#!/usr/bin/env bash
# Remove duplicate nginx server blocks for the panel hostname (certbot vs qadbak).
set -euo pipefail

PANEL_HOST="${1:-}"
if [[ -z "$PANEL_HOST" ]]; then
  echo "Usage: sudo bash scripts/dedupe-nginx-panel-vhosts.sh PANEL_HOSTNAME" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

ENABLED="/etc/nginx/sites-enabled"
KEEP="qadbak"
removed=0

for link in "$ENABLED"/*; do
  [[ -e "$link" ]] || continue
  base="$(basename "$link")"
  [[ "$base" == "$KEEP" || "$base" == qadbak-* ]] && continue
  if grep -qE "server_name[[:space:]].*\\b${PANEL_HOST}\\b" "$link" 2>/dev/null; then
    echo "==> Disable duplicate panel vhost: $base (use sites-enabled/$KEEP)"
    rm -f "$link"
    removed=$((removed + 1))
  fi
done

if [[ "$removed" -gt 0 ]]; then
  nginx -t
  systemctl reload nginx
  echo "Removed $removed duplicate site(s)."
else
  echo "No duplicate panel vhosts found for $PANEL_HOST."
fi
