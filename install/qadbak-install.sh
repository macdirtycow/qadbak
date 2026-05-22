#!/usr/bin/env bash
# Qadbak all-in-one installer — Ubuntu 22.04 + VirtualMin + panel UI
set -euo pipefail

QADBAK_REPO="${QADBAK_REPO:-https://github.com/macdirtycow/qadbak.git}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-install.sh" >&2
  exit 1
fi

echo ""
echo "  WARNING: Use a DEDICATED test VPS only."
echo "  Do not run on production hosts (e.g. servers with live client sites)."
echo "  Guide: docs/V1-TEST-SERVER.md"
echo ""
read -rp "Continue on this machine? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

if ! grep -q '22.04' /etc/os-release 2>/dev/null; then
  echo "Warning: this script targets Ubuntu 22.04." >&2
fi

FQDN="$(hostname -f 2>/dev/null || hostname)"
echo "Server FQDN: $FQDN"
echo "Qadbak becomes the homepage on port 80/443 (IP and hostname), not VirtualMin :10000."
read -rp "Panel hostname — users open Qadbak here (DNS → this server) [$FQDN]: " PANEL_HOST
PANEL_HOST="${PANEL_HOST:-$FQDN}"
if [[ "$PANEL_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "  Do not use a bare IP as panel hostname (breaks TLS/mail). Using $FQDN instead." >&2
  PANEL_HOST="$FQDN"
fi
read -rp "Also expose panel on TCP 11000 (recommended for Contabo)? [Y/n]: " USE_ALT_PORT
USE_ALT_PORT="${USE_ALT_PORT:-Y}"
PANEL_ALT_PORT=""
if [[ ! "$USE_ALT_PORT" =~ ^[Nn]$ ]]; then
  read -rp "Extra public panel port [11000]: " PANEL_ALT_PORT
  PANEL_ALT_PORT="${PANEL_ALT_PORT:-11000}"
fi
read -rp "Also answer HTTPS for server FQDN $FQDN? [Y/n]: " ALSO_FQDN
ALSO_FQDN="${ALSO_FQDN:-Y}"
if [[ ! "$ALSO_FQDN" =~ ^[Yy] ]]; then
  SERVER_FQDN="$PANEL_HOST"
else
  SERVER_FQDN="$FQDN"
fi
read -rsp "VirtualMin/Webmin root password: " VM_PASS
echo
read -rp "Qadbak admin username [admin]: " QB_USER
QB_USER="${QB_USER:-admin}"
read -rsp "Qadbak admin password: " QB_PASS
echo
read -rp "Certbot email (Let's Encrypt): " LE_EMAIL
read -rp "Create demo client user (for RBAC tests)? [y/N]: " ADD_CLIENT
ADD_CLIENT="${ADD_CLIENT:-N}"
CLIENT_USER="klant"
CLIENT_PASS=""
if [[ "$ADD_CLIENT" =~ ^[Yy]$ ]]; then
  read -rp "Client username [$CLIENT_USER]: " CLIENT_USER
  CLIENT_USER="${CLIENT_USER:-klant}"
  read -rsp "Client password: " CLIENT_PASS
  echo
fi
read -rp "Configure UFW firewall (22, 80, 443)? [y/N]: " SET_UFW
SET_UFW="${SET_UFW:-N}"

echo "==> Preflight"
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  echo "==> Node.js $NODE_MAJOR + npm (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y -qq nodejs
fi
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm missing after nodejs install" >&2
  exit 1
fi
echo "    node $(node -v) · npm $(npm -v)"

if ! command -v pm2 &>/dev/null; then
  echo "==> pm2 (via npm)"
  npm install -g pm2
fi
echo "    pm2 $(pm2 -v 2>/dev/null || echo installed)"

if [[ ! -x /usr/share/webmin/virtualmin/install.sh ]] && [[ ! -f /etc/webmin/virtual-server ]]; then
  echo "==> VirtualMin (official install.sh)"
  wget -qO /tmp/virtualmin-install.sh https://software.virtualmin.com/gpl/scripts/virtualmin-install.sh
  chmod +x /tmp/virtualmin-install.sh
  if ! /tmp/virtualmin-install.sh --minimal --hostname "$PANEL_HOST"; then
    echo "WARNING: VirtualMin install.sh exited with an error — check /tmp/virtualmin-install.log" >&2
    echo "Continuing; remote.cgi may not be ready yet." >&2
  fi
else
  echo "==> VirtualMin already present, skipping install.sh"
fi

echo "==> Wait for remote.cgi"
VM_READY=0
for i in $(seq 1 60); do
  if curl -sk -o /dev/null -w "%{http_code}" "https://127.0.0.1:10000/virtual-server/remote.cgi" | grep -qE '401|200'; then
    VM_READY=1
    break
  fi
  sleep 5
done
if [[ "$VM_READY" -ne 1 ]]; then
  echo "ERROR: VirtualMin remote.cgi not reachable on 127.0.0.1:10000" >&2
  exit 1
fi

echo "==> Qadbak app user and directory"
if ! id "$QADBAK_USER" &>/dev/null; then
  useradd -r -m -d "$QADBAK_DIR" -s /bin/bash "$QADBAK_USER"
fi
if [[ ! -d "$QADBAK_DIR/.git" ]]; then
  git clone "$QADBAK_REPO" "$QADBAK_DIR"
else
  echo "==> Updating existing clone"
  git -C "$QADBAK_DIR" pull --ff-only || true
fi
chown -R "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR"

SECRET="$(openssl rand -base64 32)"

sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"

ENV_FILE="$QADBAK_DIR/.env.local"
cat >"$ENV_FILE" <<EOF
SESSION_SECRET=$SECRET
VIRTUALMIN_MOCK=false
VIRTUALMIN_URL=https://127.0.0.1:10000/virtual-server/remote.cgi
VIRTUALMIN_USER=root
VIRTUALMIN_PASS=$VM_PASS
WEBMIN_UI_URL=https://${SERVER_FQDN}:10000
USERMIN_UI_URL=https://${SERVER_FQDN}:20000
VIRTUALMIN_UI_URL=https://${SERVER_FQDN}:10000
QADBAK_PUBLIC_HOST=$PANEL_HOST
QADBAK_ORIGIN_IP=${ORIGIN_IP:-$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}
# HTTP panel (e.g. :11000 on Contabo) needs non-Secure cookies until HTTPS works
QADBAK_COOKIE_SECURE=true
if [[ -n "$PANEL_ALT_PORT" ]]; then
  QADBAK_COOKIE_SECURE=false
fi
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0
EOF
chmod 600 "$ENV_FILE"
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"

echo "==> Native file manager (sudo helper)"
NODE_BIN="$(command -v node)"
chmod 755 "$QADBAK_DIR/scripts/domain-fs-helper.mjs"
SUDOERS="/etc/sudoers.d/qadbak-domain-fs"
cat >"$SUDOERS" <<EOF
# Qadbak native file browser — list/read/write under /home/
$QADBAK_USER ALL=(root) NOPASSWD: $NODE_BIN $QADBAK_DIR/scripts/domain-fs-helper.mjs *
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS" 2>/dev/null || true

echo "==> Website repair (sudo)"
REPAIR_SCRIPT="$QADBAK_DIR/scripts/fix-domain-website.sh"
chmod 755 "$REPAIR_SCRIPT"
SUDOERS_REPAIR="/etc/sudoers.d/qadbak-domain-repair"
cat >"$SUDOERS_REPAIR" <<EOF
$QADBAK_USER ALL=(root) NOPASSWD: $REPAIR_SCRIPT *
EOF
chmod 440 "$SUDOERS_REPAIR"
visudo -cf "$SUDOERS_REPAIR" 2>/dev/null || true

echo "==> Panel admin user"
HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$QB_PASS")"
USERS_FILE="$QADBAK_DIR/data/users.json"
mkdir -p "$QADBAK_DIR/data"
if [[ "$ADD_CLIENT" =~ ^[Yy]$ && -n "$CLIENT_PASS" ]]; then
  CLIENT_HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$CLIENT_PASS")"
  cat >"$USERS_FILE" <<EOF
[
  {
    "id": "admin-1",
    "username": "$QB_USER",
    "passwordHash": "$HASH",
    "role": "admin",
    "domains": []
  },
  {
    "id": "client-1",
    "username": "$CLIENT_USER",
    "passwordHash": "$CLIENT_HASH",
    "role": "client",
    "domains": []
  }
]
EOF
else
  cat >"$USERS_FILE" <<EOF
[
  {
    "id": "admin-1",
    "username": "$QB_USER",
    "passwordHash": "$HASH",
    "role": "admin",
    "domains": []
  }
]
EOF
fi
chown "$QADBAK_USER:$QADBAK_USER" "$USERS_FILE"
chmod 600 "$USERS_FILE"

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

echo "==> pm2"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && pm2 delete qadbak 2>/dev/null || true; pm2 start npm --name qadbak -- start && pm2 save"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$QADBAK_USER" --hp "$QADBAK_DIR" | tail -1 | bash || true

echo "==> nginx (80/443 → Qadbak; :10000 stays Webmin)"
NGX="/etc/nginx/sites-available/qadbak"
sed -e "s/__PANEL_HOST__/$PANEL_HOST/g" -e "s/__SERVER_FQDN__/$SERVER_FQDN/g" \
  "$QADBAK_DIR/deploy/nginx-qadbak.conf" >"$NGX"
ln -sf "$NGX" /etc/nginx/sites-enabled/qadbak
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

if [[ -n "$LE_EMAIL" ]]; then
  CERT_DOMAINS=(-d "$PANEL_HOST")
  [[ "$SERVER_FQDN" != "$PANEL_HOST" ]] && CERT_DOMAINS+=(-d "$SERVER_FQDN")
  certbot --nginx "${CERT_DOMAINS[@]}" --non-interactive --agree-tos -m "$LE_EMAIL" || true
fi

if [[ "$SET_UFW" =~ ^[Yy]$ ]]; then
  echo "==> UFW"
  PANEL_ALT_PORT="${PANEL_ALT_PORT:-}" OPEN_WEBMIN=N bash "$QADBAK_DIR/scripts/configure-ufw-qadbak.sh" || true
fi

if [[ -n "$PANEL_ALT_PORT" ]]; then
  echo "==> Public panel port $PANEL_ALT_PORT (nginx + host firewall)"
  bash "$QADBAK_DIR/scripts/enable-panel-port.sh" "$PANEL_ALT_PORT"
fi

VERIFY_OK=0

echo "==> Post-install verify (preflight + API + E2E)"
if bash "$QADBAK_DIR/scripts/post-install-verify.sh"; then
  VERIFY_OK=1
else
  VERIFY_OK=0
  echo "WARNING: post-install verification had failures — see above." >&2
fi

echo ""
echo "============================================"
echo " Qadbak install complete"
echo " Front door (Qadbak UI):"
echo "   http://YOUR_SERVER_IP/     → Qadbak"
echo "   https://$PANEL_HOST/login"
[[ "$SERVER_FQDN" != "$PANEL_HOST" ]] && echo "   https://$SERVER_FQDN/login"
if [[ -n "$PANEL_ALT_PORT" ]]; then
  echo "   http://YOUR_SERVER_IP:$PANEL_ALT_PORT/login  (Contabo: open TCP $PANEL_ALT_PORT in cloud firewall)"
fi
echo " User:   $QB_USER"
echo " Webmin (engine, not homepage): https://${FQDN}:10000"
echo " Re-verify: sudo bash $QADBAK_DIR/scripts/post-install-verify.sh"
echo " Update:   sudo bash $QADBAK_DIR/scripts/update-qadbak.sh"
echo " Manual:   $QADBAK_DIR/docs/E2E-CHECKLIST.md (domains/mail/DNS in VirtualMin)"
[[ "$ADD_CLIENT" =~ ^[Yy]$ ]] && echo " Client: $CLIENT_USER (assign domains in data/users.json)"
[[ "$VERIFY_OK" -eq 1 ]] && echo " Post-install: PASSED" || echo " Post-install: check warnings"
echo "============================================"
