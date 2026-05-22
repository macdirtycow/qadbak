#!/usr/bin/env bash
# Pull latest Qadbak, configure sudo helpers, rebuild, restart — run on VPS as root.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-server-fixes.sh" >&2
  exit 1
fi

cd "$QADBAK_DIR"
echo "==> git pull"
git pull

echo "==> Nginx (hosted domains → Apache, panel host → Qadbak)"
bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh"

echo "==> Sudo helpers"
bash "$QADBAK_DIR/scripts/configure-domain-fs-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-domain-repair-sudo.sh" 2>/dev/null || true

echo "==> Test VirtualMin login link"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/test-login-link.sh siccamanagement.nl" || true

echo "==> Verify repair sudo"
REPAIR="$QADBAK_DIR/scripts/fix-domain-website.sh"
sudo -u "$QADBAK_USER" sudo -n "$REPAIR" __probe__ || {
  echo "Repair sudo failed — run: sudo bash scripts/configure-domain-repair-sudo.sh" >&2
}

echo "==> Build + restart"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm run build"
sudo -u "$QADBAK_USER" pm2 restart qadbak

echo "==> Website repair (Cloudflare 523)"
bash "$QADBAK_DIR/scripts/fix-domain-website.sh" siccamanagement.nl || true

echo ""
echo "Done. Open Files in Qadbak — you should see native file list or working embed."
