#!/usr/bin/env bash
# Run on siccamanagement (or any VPS) as root — local license API on :8787 for testing.
# Production later: same app behind https://license.omiiba.dev
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
PREMIUM_DIR="${QADBAK_PREMIUM_DIR:-/opt/qadbak-premium}"
LICENSE_HOME="${QADBAK_LICENSE_HOME:-/opt/qadbak-license-server}"
ENV_FILE="${QADBAK_LICENSE_ENV:-/etc/qadbak/license-server.env}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
PORT="${LICENSE_PORT:-8787}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

mkdir -p /etc/qadbak "$(dirname "$ENV_FILE")"

if [[ ! -d "$PREMIUM_DIR/.git" ]]; then
  echo "==> Clone qadbak-premium"
  git clone https://github.com/macdirtycow/qadbak-premium.git "$PREMIUM_DIR"
fi

if [[ "$LICENSE_HOME" != "$PREMIUM_DIR/license-server" ]]; then
  rm -f "$LICENSE_HOME"
  ln -sfn "$PREMIUM_DIR/license-server" "$LICENSE_HOME"
fi

cd "$LICENSE_HOME"
npm install --omit=dev 2>/dev/null || npm install

if [[ ! -f "$ENV_FILE" ]]; then
  JWT="$(openssl rand -base64 32)"
  ADMIN="$(openssl rand -hex 24)"
  cat >"$ENV_FILE" <<EOF
# Qadbak license server — keep secret
LICENSE_PORT=$PORT
LICENSE_JWT_SECRET=$JWT
LICENSE_ADMIN_TOKEN=$ADMIN
LICENSE_DB_PATH=$LICENSE_HOME/data/licenses.json
LICENSE_ARTIFACTS_DIR=$LICENSE_HOME/data/artifacts
EOF
  chmod 600 "$ENV_FILE"
  echo "==> Created $ENV_FILE"
else
  echo "==> Using existing $ENV_FILE"
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ ! -f "$LICENSE_DB_PATH" ]]; then
  echo "==> init-db"
  npm run init-db
fi

WRAPPER="$QADBAK_DIR/scripts/run-license-server.sh"
chmod +x "$WRAPPER"

echo "==> pm2 license server"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
pm2 delete qadbak-license 2>/dev/null || true
pm2 start "$WRAPPER" --name qadbak-license
pm2 save

sleep 1
if curl -sf "http://127.0.0.1:${PORT}/health" | grep -q '"ok"'; then
  echo "OK — license server http://127.0.0.1:${PORT}/health"
else
  echo "WARN — health check failed; check: pm2 logs qadbak-license" >&2
fi

PANEL_ENV="$QADBAK_DIR/.env.local"
touch "$PANEL_ENV"
if grep -q '^QADBAK_LICENSE_SERVER=' "$PANEL_ENV" 2>/dev/null; then
  sed -i "s|^QADBAK_LICENSE_SERVER=.*|QADBAK_LICENSE_SERVER=http://127.0.0.1:${PORT}|" "$PANEL_ENV"
else
  echo "QADBAK_LICENSE_SERVER=http://127.0.0.1:${PORT}" >>"$PANEL_ENV"
fi
if grep -q '^QADBAK_LICENSE_JWT_SECRET=' "$PANEL_ENV" 2>/dev/null; then
  sed -i "s|^QADBAK_LICENSE_JWT_SECRET=.*|QADBAK_LICENSE_JWT_SECRET=${LICENSE_JWT_SECRET}|" "$PANEL_ENV"
else
  echo "QADBAK_LICENSE_JWT_SECRET=${LICENSE_JWT_SECRET}" >>"$PANEL_ENV"
fi
chown "$QADBAK_USER:$QADBAK_USER" "$PANEL_ENV"
chmod 640 "$PANEL_ENV"

echo ""
echo "Panel .env.local updated (QADBAK_LICENSE_SERVER + JWT secret)."
echo "Admin token (generate keys): $LICENSE_ADMIN_TOKEN"
echo "Next: sudo bash $QADBAK_DIR/scripts/test-license-flow.sh"
