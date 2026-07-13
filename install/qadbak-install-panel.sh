#!/usr/bin/env bash
# Qadbak panel-only installer - Node.js UI without native hosting stack.
# Use on any Linux with Node 20+, or Debian/Ubuntu where Node is installed automatically.
set -euo pipefail

QADBAK_REPO="${QADBAK_REPO:-https://github.com/macdirtycow/qadbak.git}"
QADBAK_GIT_BRANCH="${QADBAK_GIT_BRANCH:-main}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
NODE_MAJOR="${NODE_MAJOR:-20}"

INSTALL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../scripts/lib/linux-distro.sh
source "$(dirname "$0")/../scripts/lib/linux-distro.sh"
# shellcheck source=../scripts/lib/installer-ui.sh
source "$(dirname "$0")/../scripts/lib/installer-ui.sh"

QADBAK_INSTALL_VERSION="$(qadbak_install_version_from_repo "$INSTALL_ROOT" || echo "")"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-install-panel.sh" >&2
  exit 1
fi

qadbak_install_panel_banner
qadbak_install_panel_components

if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  echo "Existing install at $QADBAK_DIR - aborting to avoid overwrite."
  echo "Remove .env.local first or use install/qadbak-uninstall.sh"
  exit 1
fi

qadbak_install_prompt_continue "Would you like to continue with the installation? [y/N]: "

FQDN="$(hostname -f 2>/dev/null || hostname)"
qadbak_install_prompt_fqdn PANEL_HOST "$FQDN"
qadbak_install_explain_accounts
qadbak_install_prompt_username QB_USER admin
qadbak_install_prompt_password QB_PASS
qadbak_install_prompt_email LE_EMAIL 1

echo ""
echo "Provisioning mode:"
echo "  1) Mock/demo (no server backend - UI development)"
echo "  2) Hybrid remote API (legacy hosting API on another host)"
read -rp "Choice [1]: " PROV_MODE
PROV_MODE="${PROV_MODE:-1}"

LEGACY_URL=""
LEGACY_USER=""
LEGACY_PASS=""
if [[ "$PROV_MODE" == "2" ]]; then
  read -rp "Legacy API URL: " LEGACY_URL
  read -rp "API user: " LEGACY_USER
  read -rsp "API password: " LEGACY_PASS
  echo
fi

qadbak_install_begin_logging

qadbak_install_step "Updating packages and installing Node.js ${NODE_MAJOR}..."
qadbak_load_os_release || true
if qadbak_has_apt; then
  qadbak_pkg_update || true
  qadbak_pkg_install curl git ca-certificates openssl || true
  qadbak_install_nodejs "$NODE_MAJOR" || true
else
  echo "  Non-apt OS detected - Node.js ${NODE_MAJOR}+ must already be on PATH."
fi

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  echo "Node.js ${NODE_MAJOR}+ is required. Install it, then re-run this script." >&2
  exit 1
fi

command -v pm2 &>/dev/null || npm install -g pm2

qadbak_install_step "Creating Qadbak service user..."
if ! id "$QADBAK_USER" &>/dev/null; then
  useradd -r -m -d "$QADBAK_DIR" -s /bin/bash "$QADBAK_USER"
fi
qadbak_install_step "Cloning Qadbak repository..."
[[ -d "$QADBAK_DIR/.git" ]] || git clone -b "$QADBAK_GIT_BRANCH" "$QADBAK_REPO" "$QADBAK_DIR"
if [[ -f "$QADBAK_DIR/scripts/git-sync-origin.sh" ]]; then
  QADBAK_DIR="$QADBAK_DIR" bash "$QADBAK_DIR/scripts/git-sync-origin.sh"
else
  git -C "$QADBAK_DIR" pull --ff-only || true
fi
chown -R "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR"

qadbak_install_step "Building Qadbak panel..."
if qadbak_has_apt; then
  bash "$QADBAK_DIR/scripts/install-node-build-deps.sh" || true
fi
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && npm install && npm run build"

SECRET="$(openssl rand -base64 32)"
INSTALL_SALT="$(openssl rand -hex 8 2>/dev/null || head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
ENV_FILE="$QADBAK_DIR/.env.local"
cat >"$ENV_FILE" <<EOF
SESSION_SECRET=$SECRET
QADBAK_INSTALL_SALT=$INSTALL_SALT
NEXT_PUBLIC_QADBAK_API_SALT=$INSTALL_SALT
QADBAK_INSTALL_MODE=panel-only
QADBAK_DISABLE_LEGACY_PANEL=true
QADBAK_PUBLIC_HOST=$PANEL_HOST
PORT=3000
QADBAK_TERMINAL_WS_PORT=3001
QADBAK_TERMINAL_WS_HOST=127.0.0.1
QADBAK_COOKIE_SECURE=false
QADBAK_GIT_BRANCH=$QADBAK_GIT_BRANCH
EOF
if [[ -n "${LE_EMAIL// }" ]]; then
  echo "QADBAK_LE_EMAIL=$LE_EMAIL" >>"$ENV_FILE"
fi

if [[ "$PROV_MODE" == "2" ]]; then
  cat >>"$ENV_FILE" <<EOF
QADBAK_PROVISIONER=hybrid
QADBAK_LEGACY_API_FALLBACK=true
QADBAK_LEGACY_API_URL=$LEGACY_URL
QADBAK_LEGACY_API_USER=$LEGACY_USER
QADBAK_LEGACY_API_PASS=$LEGACY_PASS
QADBAK_LEGACY_API_MOCK=false
QADBAK_LEGACY_API_TLS_INSECURE=true
EOF
else
  cat >>"$ENV_FILE" <<EOF
QADBAK_PROVISIONER=hybrid
QADBAK_LEGACY_API_MOCK=true
QADBAK_LEGACY_API_FALLBACK=true
EOF
fi

chmod 600 "$ENV_FILE"
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"

if [[ -f "$QADBAK_DIR/scripts/ensure-install-salt.sh" ]]; then
  bash "$QADBAK_DIR/scripts/ensure-install-salt.sh" --quiet || true
fi

HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$QB_PASS")"
mkdir -p "$QADBAK_DIR/data"
cat >"$QADBAK_DIR/data/users.json" <<EOF
[{"id":"admin-1","username":"$QB_USER","passwordHash":"$HASH","role":"admin","domains":[]}]
EOF
chown "$QADBAK_USER:$QADBAK_USER" "$QADBAK_DIR/data/users.json"
chmod 600 "$QADBAK_DIR/data/users.json"

INSTALL_TEST_ENV="$QADBAK_DIR/.install-test.env"
cat >"$INSTALL_TEST_ENV" <<EOF
E2E_ADMIN_USER=$QB_USER
E2E_ADMIN_PASS=$QB_PASS
EOF
chmod 600 "$INSTALL_TEST_ENV"
chown "$QADBAK_USER:$QADBAK_USER" "$INSTALL_TEST_ENV"

for s in configure-panel-pm2-sudo configure-updates-sudo; do
  if [[ -f "$QADBAK_DIR/scripts/${s}.sh" ]]; then
    qadbak_install_step "Running ${s}..."
    bash "$QADBAK_DIR/scripts/${s}.sh" || true
  fi
done

qadbak_install_step "Starting Qadbak panel (pm2)..."
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"

PM2_STARTUP_CMD="$(env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$QADBAK_USER" --hp "$QADBAK_DIR" 2>&1 \
  | grep -E '^(sudo[[:space:]]+)?env[[:space:]]+PATH=' \
  | tail -1 || true)"
if [[ -n "$PM2_STARTUP_CMD" ]]; then
  bash -c "$PM2_STARTUP_CMD" || true
fi

if qadbak_has_apt; then
  read -rp "Install nginx reverse proxy for the panel on this host? [Y/n]: " NGINX_CHOICE
  if [[ ! "${NGINX_CHOICE:-Y}" =~ ^[Nn]$ ]]; then
    bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 80 2>/dev/null || true
    bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 443 2>/dev/null || true
    bash "$QADBAK_DIR/scripts/install-panel-nginx.sh" "$PANEL_HOST" || true
  fi
fi

VERIFY_OK=0
qadbak_install_step "Running post-install verification..."
if bash "$QADBAK_DIR/scripts/post-install-verify.sh"; then
  VERIFY_OK=1
fi

if [[ -f /etc/nginx/sites-enabled/qadbak-panel-only ]]; then
  PANEL_URL="https://${PANEL_HOST}/login"
else
  PANEL_URL="http://127.0.0.1:3000/login"
fi
qadbak_install_congratulations "$PANEL_URL" "$QB_USER"
if [[ "$PROV_MODE" == "2" ]]; then
  echo "  Hybrid: domains come from your remote legacy API"
else
  echo "  Mock:   UI demo only - use install/qadbak-install.sh for real hosting"
fi
[[ "$VERIFY_OK" -eq 1 ]] && echo "  Verify: PASSED" || echo "  Verify: check warnings above"
echo "  Updates: sudo bash $QADBAK_DIR/scripts/update-qadbak.sh"
echo "  Docs:    docs/LINUX-SUPPORT.md"
echo ""
