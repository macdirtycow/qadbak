#!/usr/bin/env bash
# Qadbak native install — hosting stack without VirtualMin/Webmin on this machine.
set -euo pipefail

QADBAK_REPO="${QADBAK_REPO:-https://github.com/macdirtycow/qadbak.git}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
NODE_MAJOR="${NODE_MAJOR:-20}"
export QADBAK_NATIVE_INSTALL=1

NATIVE_FEATURES="${QADBAK_NATIVE_FEATURES:-ssl,dns,mail,db,domain,backup,cron,aliases,redirects,features,logs,php,ftp,limits,lifecycle,mail-settings,mail-logs,imap,protected,shared,proxies,scripts,security,resellers}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-install-native.sh" >&2
  exit 1
fi

echo ""
echo "  Qadbak NATIVE install — nginx, Apache, MariaDB, Postfix, Dovecot, BIND"
echo "  No VirtualMin/Webmin GPL installer on this machine."
echo "  Guide: docs/QADBAK-NATIVE-INSTALL.md"
echo ""
read -rp "Continue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  exit 0
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
read -rp "Remote VirtualMin API URL (blank = fully independent native): " REMOTE_VM_URL
REMOTE_VM_URL="${REMOTE_VM_URL:-}"
REMOTE_VM_PASS=""
if [[ -n "$REMOTE_VM_URL" ]]; then
  read -rsp "Remote VirtualMin root password: " REMOTE_VM_PASS
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
[[ -d "$QADBAK_DIR/.git" ]] || git clone "$QADBAK_REPO" "$QADBAK_DIR"
git -C "$QADBAK_DIR" pull --ff-only || true
chown -R "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR"

SECRET="$(openssl rand -base64 32)"
ORIGIN_IP="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"

ENV_FILE="$QADBAK_DIR/.env.local"
if [[ -n "$REMOTE_VM_URL" ]]; then
  cat >"$ENV_FILE" <<EOF
SESSION_SECRET=$SECRET
QADBAK_INSTALL_MODE=native
QADBAK_NATIVE_INSTALL=1
QADBAK_DISABLE_WEBMIN=true
VIRTUALMIN_MOCK=false
VIRTUALMIN_URL=$REMOTE_VM_URL
VIRTUALMIN_USER=root
VIRTUALMIN_PASS=$REMOTE_VM_PASS
QADBAK_PROVISIONER=hybrid
QADBAK_VIRTUALMIN_FALLBACK=true
QADBAK_NATIVE_FEATURES=$NATIVE_FEATURES
QADBAK_PUBLIC_HOST=$PANEL_HOST
QADBAK_ORIGIN_IP=$ORIGIN_IP
PORT=3000
VIRTUALMIN_TLS_INSECURE=true
QADBAK_COOKIE_SECURE=false
EOF
else
  cat >"$ENV_FILE" <<EOF
SESSION_SECRET=$SECRET
QADBAK_INSTALL_MODE=native
QADBAK_NATIVE_INSTALL=1
QADBAK_DISABLE_WEBMIN=true
QADBAK_PROVISIONER=native
QADBAK_VIRTUALMIN_FALLBACK=false
QADBAK_NATIVE_FEATURES=$NATIVE_FEATURES
QADBAK_PUBLIC_HOST=$PANEL_HOST
QADBAK_ORIGIN_IP=$ORIGIN_IP
PORT=3000
QADBAK_COOKIE_SECURE=false
EOF
fi
chmod 600 "$ENV_FILE"
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"

for s in configure-domain-fs-sudo configure-domain-repair-sudo configure-domain-terminal-sudo \
  configure-host-services-sudo configure-stack-helper-sudo configure-admin-terminal-sudo; do
  bash "$QADBAK_DIR/scripts/${s}.sh"
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
[[ -n "$LE_EMAIL" ]] && certbot --nginx -d "$PANEL_HOST" --non-interactive --agree-tos -m "$LE_EMAIL" || true

if [[ -z "$REMOTE_VM_URL" ]]; then
  echo "==> Native domain registry"
  bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true
  echo "==> Phase 8 independent (native provisioner)"
  bash "$QADBAK_DIR/scripts/apply-phase8-independent.sh" || true
else
  echo "==> Hybrid native features (remote VirtualMin API)"
  bash "$QADBAK_DIR/scripts/apply-phase8-native-v1-panel.sh" || true
fi

sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && pm2 delete qadbak 2>/dev/null; pm2 start npm --name qadbak -- start && pm2 save"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$QADBAK_USER" --hp "$QADBAK_DIR" | tail -1 | bash || true

VERIFY_OK=0
echo "==> Post-install verify"
if bash "$QADBAK_DIR/scripts/post-install-verify.sh"; then
  VERIFY_OK=1
fi

echo ""
echo "============================================"
echo " Qadbak native install complete"
echo " Panel: https://$PANEL_HOST/login"
[[ -n "$PANEL_ALT_PORT" ]] && echo "        http://YOUR_SERVER_IP:$PANEL_ALT_PORT/login"
echo " User:  $QB_USER"
echo " Mode:  ${REMOTE_VM_URL:+hybrid (remote VirtualMin)}${REMOTE_VM_URL:-independent native}"
echo " Re-verify: sudo bash $QADBAK_DIR/scripts/post-install-verify.sh"
[[ "$ADD_CLIENT" =~ ^[Yy]$ ]] && echo " Client: $CLIENT_USER"
[[ "$VERIFY_OK" -eq 1 ]] && echo " Post-install: PASSED" || echo " Post-install: check warnings above"
echo "============================================"
