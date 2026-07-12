#!/usr/bin/env bash
# Deploy inveil.net on the main VPS — only needs /opt/qadbak (no qadbak-premium).
#
# Usage (on main VPS as root):
#   sudo bash /opt/qadbak/inveil-site/ops/migrate-site.sh
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$(cd "$OPS_DIR/.." && pwd)"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

if [[ -d "$QADBAK_DIR/.git" ]]; then
  echo "==> git pull qadbak"
  git -C "$QADBAK_DIR" pull --ff-only origin main || git -C "$QADBAK_DIR" pull --ff-only || true
  SITE_DIR="$QADBAK_DIR/inveil-site"
fi

[[ -f "$SITE_DIR/index.html" ]] || {
  echo "Missing $SITE_DIR — clone qadbak to $QADBAK_DIR first" >&2
  exit 1
}

echo "==> deploy static files"
export INVEIL_SITE_SRC="$SITE_DIR"
bash "$SITE_DIR/ops/deploy-vps.sh"

echo "==> configure nginx"
export INVEIL_LEGACY_REDIRECTS="${INVEIL_LEGACY_REDIRECTS:-apex}"
bash "$SITE_DIR/ops/configure-nginx.sh"

echo ""
echo "Test:"
echo "  curl -sfI https://inveil.net/ | head -1"
echo "  curl -sfI https://inveil.dev/ | head -1"
