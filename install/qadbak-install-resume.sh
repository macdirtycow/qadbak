#!/usr/bin/env bash
# Resume Qadbak install after a mid-install failure (e.g. domain-fs sudo verify).
# Does not re-run npm build or stack install — only sudoers, users (if missing), hosting, pm2, verify.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash install/qadbak-install-resume.sh" >&2
  exit 1
}

# shellcheck source=/dev/null
[[ -f "$QADBAK_DIR/.env.local" ]] || {
  echo "Missing $QADBAK_DIR/.env.local — run install/qadbak-install.sh first." >&2
  exit 1
}

PANEL_HOST="$(grep '^QADBAK_PUBLIC_HOST=' "$QADBAK_DIR/.env.local" | cut -d= -f2-)"
ORIGIN_IP="$(grep '^QADBAK_ORIGIN_IP=' "$QADBAK_DIR/.env.local" | cut -d= -f2-)"

echo "==> Sudoers + helpers"
for s in configure-domain-fs-sudo configure-domain-repair-sudo configure-domain-terminal-sudo \
  configure-panel-vhost-sudo configure-updates-sudo configure-php-fpm-sudo \
  configure-panel-pm2-sudo configure-host-services-sudo \
  configure-stack-helper-sudo \
  configure-admin-terminal-sudo configure-provisioning-helper-sudo; do
  bash "$QADBAK_DIR/scripts/${s}.sh"
done

if [[ ! -f "$QADBAK_DIR/data/users.json" ]]; then
  echo "==> Create admin user (install stopped before users.json)"
  read -rp "Panel admin username (web login) [admin]: " QB_USER
  QB_USER="${QB_USER:-admin}"
  while true; do
    read -rsp "Panel admin password (web login): " QB_PASS
    echo
    if [[ -n "$QB_PASS" ]]; then
      break
    fi
    echo "  Password cannot be empty." >&2
  done
  HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$QB_PASS")"
  mkdir -p "$QADBAK_DIR/data"
  printf '[{"id":"admin-1","username":"%s","passwordHash":"%s","role":"admin","domains":[]}]\n' \
    "$QB_USER" "$HASH" >"$QADBAK_DIR/data/users.json"
  chown "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/data/users.json"
  chmod 600 "$QADBAK_DIR/data/users.json"
fi

export PANEL_HOST SERVER_FQDN="${SERVER_FQDN:-$(hostname -f)}"
export QADBAK_NATIVE_INSTALL=1 QADBAK_DISABLE_WEBMIN=true
bash "$QADBAK_DIR/scripts/install-hosting-stack.sh"

echo "==> nginx default-deny (block unknown hostnames)"
if bash "$QADBAK_DIR/scripts/apply-nginx-default-deny.sh" --strip-conflicts; then
  bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh" || true
fi || true

bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true
bash "$QADBAK_DIR/scripts/apply-phase8-independent.sh" 2>/dev/null || true
bash "$QADBAK_DIR/scripts/configure-native-mail.sh" --force
sudo -u "$QADBAK_USER" sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-sync 2>/dev/null || true
bash "$QADBAK_DIR/scripts/ensure-terminal-deps.sh"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$QADBAK_USER" --hp "$QADBAK_DIR" | tail -1 | bash || true

if [[ -n "${QADBAK_LICENSE_KEY:-}" ]]; then
  sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/qadbak-license-cli.mjs" activate "$QADBAK_LICENSE_KEY" || true
fi

bash "$QADBAK_DIR/scripts/post-install-verify.sh"

echo ""
echo "Resume complete. Panel: https://${PANEL_HOST}/login"
[[ -n "$ORIGIN_IP" ]] && echo "  http://${ORIGIN_IP}:11000/login"
