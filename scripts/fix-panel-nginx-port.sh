#!/usr/bin/env bash
# Fix 500 errors when nginx was bound to :3000 (clashes with Next.js pm2 app).
# Usage: sudo bash scripts/fix-panel-nginx-port.sh [PANEL_PORT]
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
# shellcheck source=scripts/lib/read-env-local.sh
source "$QADBAK_DIR/scripts/lib/read-env-local.sh"
PANEL_PORT="${1:-$(read_env_local_key QADBAK_PANEL_PORT 11000)}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/fix-panel-nginx-port.sh" >&2
  exit 1
}

echo "==> Remove broken nginx site on :3000 (must not proxy panel on app port)"
rm -f /etc/nginx/sites-enabled/qadbak-port-3000 \
  /etc/nginx/sites-available/qadbak-port-3000 2>/dev/null || true

ENV_FILE="$QADBAK_DIR/.env.local"
if [[ -f "$ENV_FILE" ]] && ! grep -q '^QADBAK_PANEL_PORT=' "$ENV_FILE"; then
  echo "QADBAK_PANEL_PORT=$PANEL_PORT" >>"$ENV_FILE"
  chown qadbak:qadbak "$ENV_FILE" 2>/dev/null || true
  echo "    Added QADBAK_PANEL_PORT=$PANEL_PORT to .env.local"
fi

echo "==> Apply panel nginx on :$PANEL_PORT"
bash "$QADBAK_DIR/scripts/apply-panel-nginx-fixes.sh" "$PANEL_PORT"

if [[ -f "$QADBAK_DIR/scripts/tune-nginx-worker-connections.sh" ]]; then
  bash "$QADBAK_DIR/scripts/tune-nginx-worker-connections.sh" 4096 || true
fi

echo "==> pm2 qadbak (app on 127.0.0.1:3000)"
sudo -u qadbak bash -c "cd '$QADBAK_DIR' && pm2 restart qadbak" 2>/dev/null || \
  bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"

sleep 2
echo "==> Health (direct to Next.js, not nginx)"
if curl -sf "http://127.0.0.1:3000/api/health" | head -c 200; then
  echo ""
  echo "    OK — Next.js on :3000"
else
  echo "    FAIL — check: sudo -u qadbak pm2 logs qadbak --lines 30" >&2
fi

echo "==> Panel via nginx :$PANEL_PORT"
curl -sI "http://127.0.0.1:${PANEL_PORT}/login" | head -5 || true

echo ""
ORIGIN_IP="$(read_env_local_key QADBAK_ORIGIN_IP "")"
if [[ -z "$ORIGIN_IP" ]]; then
  ORIGIN_IP="$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
fi
echo "Open: http://${ORIGIN_IP:-YOUR_SERVER_IP}:${PANEL_PORT}/login"
echo "Do NOT use :3000 in the browser — that port is only for the Node app behind nginx."
