#!/usr/bin/env bash
# Deploy inveil-site static files to /var/www/inveil.net (or INVEIL_WEB_ROOT).
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="${INVEIL_SITE_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)/inveil-site}"
WEB_ROOT="${INVEIL_WEB_ROOT:-/var/www/inveil.net}"

if [[ ! -f "$SRC/index.html" ]]; then
  echo "Missing $SRC/index.html — set INVEIL_SITE_SRC or clone qadbak to /opt/qadbak" >&2
  exit 1
fi

mkdir -p "$WEB_ROOT"
rsync -a --delete \
  --exclude '.DS_Store' \
  "$SRC/" "$WEB_ROOT/"

chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || chown -R nginx:nginx "$WEB_ROOT" 2>/dev/null || true
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo "OK — deployed Inveil site to $WEB_ROOT"
