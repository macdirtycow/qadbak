#!/usr/bin/env bash
# Enable demo.qadbak.com on the same Qadbak panel (nginx + TLS + seed data).
# Prereq: DNS A record demo.qadbak.com → this VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"
ENV_FILE="$QADBAK_DIR/.env.local"
DEMO_HOST="${QADBAK_DEMO_HOST:-demo.qadbak.com}"
PANEL_HOST="${QADBAK_PUBLIC_HOST:-qadbak.com}"
LE_EMAIL="${QADBAK_LE_EMAIL:-admin@${PANEL_HOST#*.}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-demo-vhost.sh" >&2
  exit 1
fi

echo "==> Demo panel host: $DEMO_HOST"
echo "    Main panel:     $PANEL_HOST"
echo "    DNS: add A record $DEMO_HOST → $(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

set_env_key() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

touch "$ENV_FILE"
set_env_key "QADBAK_DEMO_HOST" "$DEMO_HOST"
set_env_key "QADBAK_DEMO_ENABLED" "true"
grep -q "^QADBAK_DEMO_USERNAME=" "$ENV_FILE" 2>/dev/null || set_env_key "QADBAK_DEMO_USERNAME" "demo"
grep -q "^QADBAK_DEMO_READ_ONLY=" "$ENV_FILE" 2>/dev/null || set_env_key "QADBAK_DEMO_READ_ONLY" "true"

echo "==> TLS certificate (expand main cert with demo host if needed)"
if command -v certbot >/dev/null 2>&1; then
  certbot certonly --nginx \
    -d "$PANEL_HOST" -d "www.${PANEL_HOST}" -d "$DEMO_HOST" \
    --non-interactive --agree-tos -m "$LE_EMAIL" --expand 2>/dev/null || \
    certbot certonly --nginx -d "$DEMO_HOST" \
      --non-interactive --agree-tos -m "$LE_EMAIL" 2>/dev/null || \
    echo "    WARN: certbot failed — set Cloudflare proxy + Flexible until DNS propagates" >&2
else
  echo "    SKIP certbot (not installed)"
fi

echo "==> Nginx panel vhosts"
bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh"

echo "==> Seed demo user + showcase domain config"
sudo -u qadbak bash -c "cd '$QADBAK_DIR' && node scripts/seed-demo-panel.mjs"

echo "==> Build + restart panel"
sudo -u qadbak bash -c "cd '$QADBAK_DIR' && npm run build"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh" 2>/dev/null || true

echo ""
echo "OK — Live demo:"
echo "  https://${DEMO_HOST}/login"
echo "  User: demo"
echo "  Pass: \${QADBAK_DEMO_PASSWORD:-DemoView2026!} (set in .env.local to override)"
echo "  Showcase domain in panel: showcase.qadbak.com (sample config; provision on VPS for full stack)"
