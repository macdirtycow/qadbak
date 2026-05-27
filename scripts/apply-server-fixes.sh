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
echo "==> git sync"
bash "$QADBAK_DIR/scripts/reset-git-drift-before-pull.sh"
bash "$QADBAK_DIR/scripts/git-sync-origin.sh"

if [[ -f "$QADBAK_DIR/.env.local" ]] && grep -q '^NODE_TLS_REJECT_UNAUTHORIZED=' "$QADBAK_DIR/.env.local" 2>/dev/null; then
  sed -i '/^NODE_TLS_REJECT_UNAUTHORIZED=/d' "$QADBAK_DIR/.env.local"
  grep -q '^VIRTUALMIN_TLS_INSECURE=' "$QADBAK_DIR/.env.local" || echo 'VIRTUALMIN_TLS_INSECURE=true' >>"$QADBAK_DIR/.env.local"
  echo "    Removed NODE_TLS_REJECT_UNAUTHORIZED from .env.local"
fi

echo "==> Sudo helpers"
bash "$QADBAK_DIR/scripts/configure-domain-fs-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-domain-repair-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-panel-vhost-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-updates-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-php-fpm-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-panel-pm2-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-domain-terminal-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-admin-terminal-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-host-services-sudo.sh"
bash "$QADBAK_DIR/scripts/configure-stack-helper-sudo.sh"

echo "==> Hosting stack (nginx, public_html, Webmin login)"
bash "$QADBAK_DIR/scripts/install-hosting-stack.sh"

PANEL_PORT=""
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  PANEL_PORT="$(grep -E '^QADBAK_PANEL_PORT=' "$QADBAK_DIR/.env.local" | cut -d= -f2- | tr -d '"' || true)"
fi
if [[ -n "$PANEL_PORT" ]]; then
  echo "==> Panel nginx :$PANEL_PORT (upload limit + terminal WS)"
  bash "$QADBAK_DIR/scripts/apply-panel-nginx-fixes.sh" "$PANEL_PORT"
fi

echo "==> Verify file helper sudo"
FS_WRAP="$(readlink -f "$QADBAK_DIR/scripts/run-domain-fs-helper.sh")"
FS_TEST_HOME="$(getent passwd | awk -F: '$6 ~ /^\/home\/[^/]+$/ {print $6; exit}')"
FS_TEST_HOME="${FS_TEST_HOME:-/home}"
sudo -u "$QADBAK_USER" sudo -n "$FS_WRAP" list "$FS_TEST_HOME" 2>/dev/null | grep -q '"ok"' || {
  echo "File helper sudo failed — check configure-domain-fs-sudo.sh" >&2
  exit 1
}

FIRST_DOMAIN=""
if command -v virtualmin &>/dev/null; then
  FIRST_DOMAIN="$(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d' | head -1)"
fi
if [[ -n "$FIRST_DOMAIN" ]]; then
  echo "==> Test VirtualMin login link ($FIRST_DOMAIN)"
  sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/test-login-link.sh '$FIRST_DOMAIN'" || true
fi

echo "==> Verify repair sudo"
REPAIR="$QADBAK_DIR/scripts/fix-domain-website.sh"
sudo -u "$QADBAK_USER" sudo -n "$REPAIR" __probe__ || {
  echo "Repair sudo failed — run: sudo bash scripts/configure-domain-repair-sudo.sh" >&2
}

echo "==> Native mail + panel webmail"
if [[ -f "$QADBAK_DIR/scripts/repair-panel-webmail.sh" ]]; then
  bash "$QADBAK_DIR/scripts/repair-panel-webmail.sh" 2>/dev/null || true
fi

echo "==> Build + restart"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm run build"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"

echo "==> Website repair (all VirtualMin domains)"
if command -v virtualmin &>/dev/null; then
  while read -r d; do
    [[ -z "$d" ]] && continue
    bash "$QADBAK_DIR/scripts/fix-domain-website.sh" "$d" || true
  done < <(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d')
else
  echo "    virtualmin not found — skip per-domain repair"
fi

echo ""
echo "Done. Open Files in Qadbak — you should see native file list or working embed."
