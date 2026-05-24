#!/usr/bin/env bash
# Qadbak panel installer — hosting stack + independent native provisioning.
set -euo pipefail

QADBAK_REPO="${QADBAK_REPO:-https://github.com/macdirtycow/qadbak.git}"
QADBAK_GIT_BRANCH="${QADBAK_GIT_BRANCH:-macdirtycow/proprietary-premium-commercialization}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
NODE_MAJOR="${NODE_MAJOR:-20}"
export QADBAK_NATIVE_INSTALL=1

NATIVE_FEATURES="${QADBAK_NATIVE_FEATURES:-ssl,dns,mail,db,domain,backup,cron,aliases,redirects,features,logs,php,ftp,limits,lifecycle,mail-settings,mail-logs,imap,protected,shared,proxies,scripts,security,resellers}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-install.sh" >&2
  exit 1
fi

echo ""
echo "  Qadbak install — nginx, Apache, MariaDB, Postfix, Dovecot, BIND"
echo "  Independent hosting panel (native provisioning on this server)."
echo "  Guide: docs/QADBAK-NATIVE-INSTALL.md"
echo ""
read -rp "Continue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  exit 0
fi

if [[ -f "$(dirname "$0")/../scripts/check-ubuntu-support.sh" ]]; then
  echo ""
  bash "$(dirname "$0")/../scripts/check-ubuntu-support.sh" || {
    echo "Fix Ubuntu support issues above before continuing." >&2
    exit 1
  }
fi

FQDN="$(hostname -f 2>/dev/null || hostname)"
read -rp "Panel hostname [$FQDN]: " PANEL_HOST
PANEL_HOST="${PANEL_HOST:-$FQDN}"
if [[ "$PANEL_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "  Do not use a bare IP as panel hostname (breaks TLS/mail). Using $FQDN instead." >&2
  PANEL_HOST="$FQDN"
fi
read -rp "Also expose panel on TCP 11000? [Y/n]: " USE_ALT_PORT
PANEL_ALT_PORT=""
if [[ ! "${USE_ALT_PORT:-Y}" =~ ^[Nn]$ ]]; then
  read -rp "Port [11000]: " PANEL_ALT_PORT
  PANEL_ALT_PORT="${PANEL_ALT_PORT:-11000}"
fi
SERVER_FQDN="$FQDN"
read -rp "Qadbak admin user [admin]: " QB_USER
QB_USER="${QB_USER:-admin}"
read -rsp "Qadbak admin password: " QB_PASS
echo
read -rp "Certbot email (optional): " LE_EMAIL
read -rp "Optional demo client user (RBAC tests)? [y/N]: " ADD_CLIENT
ADD_CLIENT="${ADD_CLIENT:-N}"
CLIENT_USER="client"
CLIENT_PASS=""
if [[ "$ADD_CLIENT" =~ ^[Yy]$ ]]; then
  read -rp "Client username [$CLIENT_USER]: " CLIENT_USER
  CLIENT_USER="${CLIENT_USER:-client}"
  read -rsp "Client password: " CLIENT_PASS
  echo
fi

apt-get update -qq
bash "$(dirname "$0")/../scripts/install-native-stack.sh"

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs curl git nginx certbot python3-certbot-nginx
fi
command -v pm2 &>/dev/null || npm install -g pm2

if ! id "$QADBAK_USER" &>/dev/null; then
  useradd -r -m -d "$QADBAK_DIR" -s /bin/bash "$QADBAK_USER"
fi
[[ -d "$QADBAK_DIR/.git" ]] || git clone -b "$QADBAK_GIT_BRANCH" "$QADBAK_REPO" "$QADBAK_DIR"
if [[ -f "$QADBAK_DIR/scripts/git-sync-origin.sh" ]]; then
  QADBAK_DIR="$QADBAK_DIR" bash "$QADBAK_DIR/scripts/git-sync-origin.sh"
else
  git -C "$QADBAK_DIR" pull --ff-only || true
fi
chown -R "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR"

bash "$QADBAK_DIR/scripts/install-node-build-deps.sh"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"

SECRET="$(openssl rand -base64 32)"
DEFAULT_ORIGIN_IP="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
read -rp "Mail hostname for MX/IMAP (FQDN) [$PANEL_HOST]: " MAIL_HOST
MAIL_HOST="${MAIL_HOST:-$PANEL_HOST}"
if [[ "$MAIL_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "  Do not use a bare IP as mail hostname (breaks inbound delivery). Using $FQDN instead." >&2
  MAIL_HOST="$FQDN"
fi
read -rp "Public server IP (for DNS hints) [$DEFAULT_ORIGIN_IP]: " ORIGIN_IP_IN
ORIGIN_IP="${ORIGIN_IP_IN:-$DEFAULT_ORIGIN_IP}"

ENV_FILE="$QADBAK_DIR/.env.local"
cat >"$ENV_FILE" <<EOF
SESSION_SECRET=$SECRET
QADBAK_INSTALL_MODE=native
QADBAK_NATIVE_INSTALL=1
QADBAK_DISABLE_WEBMIN=true
QADBAK_PROVISIONER=native
QADBAK_VIRTUALMIN_FALLBACK=false
QADBAK_MAIL_BACKEND=direct
QADBAK_MAIL_HOST=$MAIL_HOST
QADBAK_MAIL_AUTODNS=true
QADBAK_NATIVE_FEATURES=$NATIVE_FEATURES
QADBAK_PUBLIC_HOST=$PANEL_HOST
QADBAK_ORIGIN_IP=$ORIGIN_IP
PORT=3000
QADBAK_TERMINAL_WS_PORT=3001
QADBAK_TERMINAL_WS_HOST=127.0.0.1
QADBAK_COOKIE_SECURE=false
QADBAK_LICENSE_SERVER=https://license.omiiba.dev
QADBAK_GIT_BRANCH=$QADBAK_GIT_BRANCH
EOF
LICENSE_ENV="/etc/qadbak/license-server.env"
if [[ -f "$LICENSE_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$LICENSE_ENV"
  if [[ -n "${LICENSE_JWT_SECRET:-}" ]]; then
    echo "QADBAK_LICENSE_JWT_SECRET=${LICENSE_JWT_SECRET}" >>"$ENV_FILE"
  fi
fi
chmod 600 "$ENV_FILE"
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"

read -rp "Premium license key (Enter to skip — Core evaluation only): " LICENSE_KEY_IN
if [[ -n "${LICENSE_KEY_IN// /}" ]]; then
  QADBAK_LICENSE_KEY="$LICENSE_KEY_IN"
fi

for s in configure-domain-fs-sudo configure-domain-repair-sudo configure-domain-terminal-sudo \
  configure-panel-vhost-sudo configure-updates-sudo configure-php-fpm-sudo \
  configure-panel-pm2-sudo configure-host-services-sudo \
  configure-stack-helper-sudo \
  configure-admin-terminal-sudo configure-provisioning-helper-sudo; do
  if ! bash "$QADBAK_DIR/scripts/${s}.sh"; then
    echo "" >&2
    echo "WARN: $s failed — install paused. Resume without rebuilding:" >&2
    echo "  sudo bash $QADBAK_DIR/install/qadbak-install-resume.sh" >&2
    exit 1
  fi
done

HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$QB_PASS")"
mkdir -p "$QADBAK_DIR/data"
if [[ "$ADD_CLIENT" =~ ^[Yy]$ && -n "$CLIENT_PASS" ]]; then
  CLIENT_HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$CLIENT_PASS")"
  cat >"$QADBAK_DIR/data/users.json" <<EOF
[
  {"id":"admin-1","username":"$QB_USER","passwordHash":"$HASH","role":"admin","domains":[]},
  {"id":"client-1","username":"$CLIENT_USER","passwordHash":"$CLIENT_HASH","role":"client","domains":[]}
]
EOF
else
  cat >"$QADBAK_DIR/data/users.json" <<EOF
[{"id":"admin-1","username":"$QB_USER","passwordHash":"$HASH","role":"admin","domains":[]}]
EOF
fi
chown "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/data/users.json"
chmod 600 "$QADBAK_DIR/data/users.json"

INSTALL_TEST_ENV="$QADBAK_DIR/.install-test.env"
cat >"$INSTALL_TEST_ENV" <<EOF
E2E_ADMIN_USER=$QB_USER
E2E_ADMIN_PASS=$QB_PASS
EOF
if [[ "$ADD_CLIENT" =~ ^[Yy]$ && -n "$CLIENT_PASS" ]]; then
  cat >>"$INSTALL_TEST_ENV" <<EOF
E2E_CLIENT_USER=$CLIENT_USER
E2E_CLIENT_PASS=$CLIENT_PASS
EOF
fi
chmod 600 "$INSTALL_TEST_ENV"
chown "$QADBAK_USER:$QADBAK_USER" "$INSTALL_TEST_ENV"

export PANEL_HOST SERVER_FQDN QADBAK_NATIVE_INSTALL=1 QADBAK_DISABLE_WEBMIN=true
bash "$QADBAK_DIR/scripts/install-hosting-stack.sh"
[[ -n "$PANEL_ALT_PORT" ]] && bash "$QADBAK_DIR/scripts/enable-panel-port.sh" "$PANEL_ALT_PORT"
[[ -n "$LE_EMAIL" ]] && certbot --nginx -d "$PANEL_HOST" --non-interactive --agree-tos -m "$LE_EMAIL" && {
  if grep -q '^QADBAK_COOKIE_SECURE=' "$ENV_FILE"; then
    sed -i 's/^QADBAK_COOKIE_SECURE=.*/QADBAK_COOKIE_SECURE=true/' "$ENV_FILE"
  else
    echo "QADBAK_COOKIE_SECURE=true" >>"$ENV_FILE"
  fi
} || true

echo "==> Domain registry"
bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true
echo "==> Native provisioning"
bash "$QADBAK_DIR/scripts/apply-phase8-independent.sh" || true

echo "==> Inbound mail (Postfix receive + Dovecot + maps)"
bash "$QADBAK_DIR/scripts/configure-native-mail.sh" --force
sudo -u "$QADBAK_USER" sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-sync 2>/dev/null || true

bash "$QADBAK_DIR/scripts/ensure-terminal-deps.sh"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$QADBAK_USER" --hp "$QADBAK_DIR" | tail -1 | bash || true

if [[ -n "${QADBAK_LICENSE_KEY:-}" ]]; then
  sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/qadbak-license-cli.mjs" activate "$QADBAK_LICENSE_KEY" \
    || echo "  WARN: license activation failed — set QADBAK_LICENSE_JWT_SECRET, start license server, then use Server admin → License" >&2
fi

VERIFY_OK=0
echo "==> Post-install verify"
if bash "$QADBAK_DIR/scripts/post-install-verify.sh"; then
  VERIFY_OK=1
fi

echo ""
echo "============================================"
echo " Qadbak install complete"
echo " Panel: https://$PANEL_HOST/login"
[[ -n "$PANEL_ALT_PORT" ]] && echo "        http://${ORIGIN_IP}:${PANEL_ALT_PORT}/login"
echo " User:  $QB_USER"
echo " Re-verify: sudo bash $QADBAK_DIR/scripts/post-install-verify.sh"
[[ "$ADD_CLIENT" =~ ^[Yy]$ ]] && echo " Client: $CLIENT_USER"
[[ "$VERIFY_OK" -eq 1 ]] && echo " Post-install: PASSED" || echo " Post-install: check warnings above"
echo "============================================"
