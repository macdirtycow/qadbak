#!/usr/bin/env bash
# Deploy inveil.net static site + nginx on this VPS.
#   sudo bash /opt/qadbak/inveil-site/ops/deploy-inveil-site.sh
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$(cd "$OPS_DIR/.." && pwd)"

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

if [[ -d "$QADBAK_DIR/.git" ]]; then
  git -C "$QADBAK_DIR" pull --ff-only origin main || true
  SITE_DIR="$QADBAK_DIR/inveil-site"
fi

export INVEIL_SITE_SRC="$SITE_DIR"
bash "$SITE_DIR/ops/deploy-vps.sh"
bash "$SITE_DIR/ops/configure-nginx.sh"

ORIGIN_IP="$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)"

echo ""
echo "Test:"
echo "  curl -sfI https://inveil.net/ | head -1"
echo "  curl -sfI https://inveil.dev/ | head -1    # expect 301 → inveil.net"
echo ""
echo "Cloudflare DNS (this VPS):"
echo "  Zone inveil.net — @ and www → A ${ORIGIN_IP:-YOUR_VPS_IP}"
echo "  Zone inveil.dev — @ (root)   → A ${ORIGIN_IP:-YOUR_VPS_IP}   ← separate zone!"
echo "  Both zones: orange cloud OK if ports 80/443 open on VPS"
