#!/usr/bin/env bash
# Remove duplicate http2 listen options from client panel vhosts (certbot drift).
# Main panel vhost (deploy/nginx-qadbak.conf) owns http2 on 0.0.0.0:443.
set -euo pipefail

fixed=0
for f in /etc/nginx/sites-available/qadbak-panel-*.conf; do
  [[ -f "$f" ]] || continue
  if grep -qE 'listen.*443.*http2|^[[:space:]]*http2[[:space:]]+on' "$f" 2>/dev/null; then
    sed -i -E \
      -e 's/ ssl http2;/ ssl;/g' \
      -e 's/ ssl http2 default_server/ ssl default_server/g' \
      -e '/^[[:space:]]*http2[[:space:]]+on;/d' \
      "$f"
    fixed=$((fixed + 1))
  fi
done

if [[ "$fixed" -gt 0 ]]; then
  echo "    Sanitized http2 on $fixed panel vhost(s)"
  nginx -t
  systemctl reload nginx
fi
