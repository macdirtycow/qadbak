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

echo "==> nginx listen $PORT → 127.0.0.1:3000"
sed "s/__PANEL_PORT__/$PORT/g" "$ROOT/deploy/nginx-qadbak-port.conf" \
  >"/etc/nginx/sites-available/qadbak-port-$PORT"
ln -sf "/etc/nginx/sites-available/qadbak-port-$PORT" \
  "/etc/nginx/sites-enabled/qadbak-port-$PORT"
nginx -t
systemctl reload nginx

bash "$ROOT/scripts/open-host-firewall-port.sh" "$PORT"

echo ""
echo "Contabo: Network Services → Firewall → Inbound: TCP $PORT Accept (before Block all), VPS assigned."
echo "Also open TCP $PORT in your VPS provider firewall (Contabo panel)."
echo "Panel URL: http://$(curl -fsS ifconfig.me 2>/dev/null || hostname -f):$PORT/login"
echo "Local check: curl -sI http://127.0.0.1:$PORT/login | head -3"
