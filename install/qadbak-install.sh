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

if ! grep -q '22.04' /etc/os-release 2>/dev/null; then
  echo "Warning: this script targets Ubuntu 22.04." >&2
fi

read -rp "Panel hostname (DNS must point here) [qadbak.com]: " PANEL_HOST
PANEL_HOST="${PANEL_HOST:-qadbak.com}"
read -rsp "VirtualMin/Webmin root password: " VM_PASS
echo
read -rp "Qadbak admin username [admin]: " QB_USER
QB_USER="${QB_USER:-admin}"
read -rsp "Qadbak admin password: " QB_PASS
echo
read -rp "Certbot email (Let's Encrypt): " LE_EMAIL

echo "==> Preflight"
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  echo "==> Node.js $NODE_MAJOR"
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

if [[ ! -x /usr/share/webmin/virtualmin/install.sh ]] && [[ ! -f /etc/webmin/virtual-server ]]; then
  echo "==> VirtualMin (official install.sh)"
  wget -qO /tmp/virtualmin-install.sh https://software.virtualmin.com/gpl/scripts/virtualmin-install.sh
  chmod +x /tmp/virtualmin-install.sh
  /tmp/virtualmin-install.sh --minimal --hostname "$PANEL_HOST" || true
else
  echo "==> VirtualMin already present, skipping install.sh"
fi

echo "==> Wait for remote.cgi"
for i in $(seq 1 60); do
  if curl -sk -o /dev/null -w "%{http_code}" "https://127.0.0.1:10000/virtual-server/remote.cgi" | grep -qE '401|200'; then
    break
  fi
  sleep 5
done

echo "==> Qadbak app user and directory"
if ! id "$QADBAK_USER" &>/dev/null; then
  useradd -r -m -d "$QADBAK_DIR" -s /bin/bash "$QADBAK_USER"
fi
if [[ ! -d "$QADBAK_DIR/.git" ]]; then
  git clone "$QADBAK_REPO" "$QADBAK_DIR"
fi
chown -R "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR"

FQDN="$(hostname -f 2>/dev/null || hostname)"
SECRET="$(openssl rand -base64 32)"

sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"

ENV_FILE="$QADBAK_DIR/.env.local"
cat >"$ENV_FILE" <<EOF
SESSION_SECRET=$SECRET
VIRTUALMIN_MOCK=false
VIRTUALMIN_URL=https://127.0.0.1:10000/virtual-server/remote.cgi
VIRTUALMIN_USER=root
VIRTUALMIN_PASS=$VM_PASS
WEBMIN_UI_URL=https://${FQDN}:10000
USERMIN_UI_URL=https://${FQDN}:20000
VIRTUALMIN_UI_URL=https://${FQDN}:10000
QADBAK_PUBLIC_HOST=$PANEL_HOST
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0
EOF
chmod 600 "$ENV_FILE"
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"

echo "==> Panel admin user"
HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$QB_PASS")"
USERS_FILE="$QADBAK_DIR/data/users.json"
mkdir -p "$QADBAK_DIR/data"
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
chown "$QADBAK_USER:$QADBAK_USER" "$USERS_FILE"
chmod 600 "$USERS_FILE"

echo "==> pm2"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && pm2 delete qadbak 2>/dev/null || true; pm2 start npm --name qadbak -- start && pm2 save"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$QADBAK_USER" --hp "$QADBAK_DIR" | tail -1 | bash || true

echo "==> nginx"
NGX="/etc/nginx/sites-available/qadbak"
sed "s/PANEL_HOSTNAME/$PANEL_HOST/g" "$QADBAK_DIR/deploy/nginx-qadbak.conf" >"$NGX"
ln -sf "$NGX" /etc/nginx/sites-enabled/qadbak
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

if [[ -n "$LE_EMAIL" ]]; then
  certbot --nginx -d "$PANEL_HOST" --non-interactive --agree-tos -m "$LE_EMAIL" || true
fi

echo ""
echo "============================================"
echo " Qadbak install complete"
echo " Panel:  https://$PANEL_HOST/login"
echo " User:   $QB_USER"
echo " Webmin: https://${FQDN}:10000"
echo " Test:   sudo -u $QADBAK_USER bash -c 'cd $QADBAK_DIR && npm run test-api'"
echo "============================================"
