#!/usr/bin/env bash
# Deploy inveil.net static site — files + single Qadbak nginx vhost (no duplicate inveil.net.conf).
#   sudo bash /opt/qadbak/inveil-site/ops/deploy-inveil-site.sh
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$(cd "$OPS_DIR/.." && pwd)"
APEX="${INVEIL_APEX:-inveil.net}"
WEB_ROOT="${INVEIL_WEB_ROOT:-/var/www/inveil.net}"

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

if [[ -d "$QADBAK_DIR/.git" ]]; then
  git -C "$QADBAK_DIR" pull --ff-only origin main || true
  SITE_DIR="$QADBAK_DIR/inveil-site"
fi

export INVEIL_SITE_SRC="$SITE_DIR" INVEIL_WEB_ROOT="$WEB_ROOT"
bash "$SITE_DIR/ops/deploy-vps.sh"

UNIX_USER="$(jq -r --arg d "$APEX" '.[] | select(.name==$d) | .user' "$QADBAK_DIR/data/native-domains.json" 2>/dev/null | head -1)"
[[ -n "$UNIX_USER" ]] || UNIX_USER="${APEX%%.*}"

node "$QADBAK_DIR/scripts/lib/write-website-config.mjs" "$APEX" \
  --webRoot "$WEB_ROOT" --mode static --wwwRedirect apex --cacheStaticAssets

rm -f "/etc/nginx/sites-available/${APEX}.conf" "/etc/nginx/sites-enabled/${APEX}.conf" 2>/dev/null || true

bash "$QADBAK_DIR/scripts/apply-domain-nginx.sh" "$APEX" "$UNIX_USER"
bash "$SITE_DIR/ops/configure-nginx.sh"

ORIGIN_IP="$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)"

echo ""
echo "Test:"
echo "  curl -sfI https://${APEX}/ | head -1"
echo "  curl -sfI https://inveil.dev/ | head -1    # expect 301 → ${APEX}"
echo ""
echo "Cloudflare DNS (this VPS):"
echo "  Zone ${APEX} — @ and www → A ${ORIGIN_IP:-YOUR_VPS_IP}"
echo "  Zone inveil.dev — @ (root)   → A ${ORIGIN_IP:-YOUR_VPS_IP}"
