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

if [[ -f "$QADBAK_DIR/.env.local" ]] && grep -q '^NODE_TLS_REJECT_UNAUTHORIZED=' "$QADBAK_DIR/.env.local" 2>/dev/null; then
  sed -i '/^NODE_TLS_REJECT_UNAUTHORIZED=/d' "$QADBAK_DIR/.env.local"
  grep -q '^VIRTUALMIN_TLS_INSECURE=' "$QADBAK_DIR/.env.local" || echo 'VIRTUALMIN_TLS_INSECURE=true' >>"$QADBAK_DIR/.env.local"
  echo "    Removed NODE_TLS_REJECT_UNAUTHORIZED from .env.local"
fi

echo "==> Nginx (hosted domains → Apache, panel host → Qadbak)"
bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh"

echo "==> Sudo helpers"
bash "$QADBAK_DIR/scripts/configure-domain-fs-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-domain-repair-sudo.sh"

echo "==> Verify file helper sudo"
FS_WRAP="$(readlink -f "$QADBAK_DIR/scripts/run-domain-fs-helper.sh")"
sudo -u "$QADBAK_USER" sudo -n "$FS_WRAP" list /home 2>/dev/null | grep -q '"ok"' || {
  echo "File helper sudo failed — check configure-domain-fs-sudo.sh" >&2
  exit 1
}

echo "==> Test VirtualMin login link"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/test-login-link.sh siccamanagement.nl" || true

echo "==> Verify repair sudo"
REPAIR="$QADBAK_DIR/scripts/fix-domain-website.sh"
sudo -u "$QADBAK_USER" sudo -n "$REPAIR" __probe__ || {
  echo "Repair sudo failed — run: sudo bash scripts/configure-domain-repair-sudo.sh" >&2
}

echo "==> Build + restart"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm run build"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"

echo "==> Website repair (Cloudflare 523)"
bash "$QADBAK_DIR/scripts/fix-domain-website.sh" siccamanagement.nl || true

echo ""
echo "Done. Open Files in Qadbak — you should see native file list or working embed."
