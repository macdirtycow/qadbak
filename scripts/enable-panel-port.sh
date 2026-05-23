#!/usr/bin/env bash
# Expose Qadbak on an extra TCP port (default 11000) when 80/443 are blocked.
# Usage: sudo bash scripts/enable-panel-port.sh [PORT]
set -euo pipefail

PORT="${1:-11000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/enable-panel-port.sh $PORT" >&2
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [[ "$PORT" -lt 1024 ]] || [[ "$PORT" -gt 65535 ]]; then
  echo "Invalid port: $PORT" >&2
  exit 1
fi

if [[ "$PORT" == "10000" ]]; then
  echo "Port 10000 is Webmin. Use 11000 (or another port) for the Qadbak panel." >&2
  exit 1
fi

if [[ "$PORT" == "3000" ]]; then
  echo "Port 3000 is the Next.js app (pm2). Public panel nginx must use e.g. 11000 (QADBAK_PANEL_PORT)." >&2
  echo "If you see 500 errors, run: sudo bash scripts/fix-panel-nginx-port.sh" >&2
  exit 1
fi

echo "==> nginx listen $PORT → 127.0.0.1:3000"
# Remove legacy manual configs (avoid duplicate default_server on same port)
rm -f "/etc/nginx/sites-enabled/qadbak-${PORT}" \
  "/etc/nginx/sites-available/qadbak-${PORT}" 2>/dev/null || true
sed "s/__PANEL_PORT__/$PORT/g" "$ROOT/deploy/nginx-qadbak-port.conf" \
  >"/etc/nginx/sites-available/qadbak-port-$PORT"
ln -sf "/etc/nginx/sites-available/qadbak-port-$PORT" \
  "/etc/nginx/sites-enabled/qadbak-port-$PORT"
nginx -t
systemctl reload nginx

if [[ "${QADBAK_NGINX_ONLY:-}" != "1" ]]; then
  bash "$ROOT/scripts/open-host-firewall-port.sh" "$PORT"
fi

PUBLIC_IP="$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || true)"
WEBMIN_EMBED=0
if [[ -f "$ROOT/.env.local" ]]; then
  # shellcheck source=scripts/lib/read-env-local.sh
  source "$ROOT/scripts/lib/read-env-local.sh"
  DISABLE_WM="$(read_env_local_key QADBAK_DISABLE_WEBMIN false)"
  VM_FB="$(read_env_local_key QADBAK_VIRTUALMIN_FALLBACK true)"
  PROV="$(read_env_local_key QADBAK_PROVISIONER hybrid)"
  if [[ "$DISABLE_WM" =~ ^(true|1|yes)$ ]] || [[ "$PROV" == "native" ]] || [[ "$VM_FB" =~ ^(false|0|no)$ ]]; then
    WEBMIN_EMBED=0
  else
    WEBMIN_EMBED=1
  fi
fi

if [[ -n "$PUBLIC_IP" ]] && [[ "$WEBMIN_EMBED" -eq 1 ]]; then
  export QADBAK_PANEL_URL="http://${PUBLIC_IP}:${PORT}"
  export QADBAK_PANEL_PORT="$PORT"
  bash "$ROOT/scripts/sync-webmin-embed-env.sh" 2>/dev/null || true
fi

if [[ "${QADBAK_NGINX_ONLY:-}" == "1" ]]; then
  if [[ "$WEBMIN_EMBED" -eq 1 ]]; then
    echo "    Panel port :$PORT nginx refreshed (optional Webmin: nginx-webmin-embed-snippet.conf)"
  else
    echo "    Panel port :$PORT nginx refreshed (no Webmin embed — independent mode)"
  fi
  exit 0
fi

echo ""
echo "Contabo: Network Services → Firewall → Inbound: TCP $PORT Accept (before Block all), VPS assigned."
echo "Also open TCP $PORT in your VPS provider firewall (Contabo panel)."
echo "Panel URL: http://$(curl -fsS ifconfig.me 2>/dev/null || hostname -f):$PORT/login"
echo "Local check: curl -sI http://127.0.0.1:$PORT/login | head -3"
