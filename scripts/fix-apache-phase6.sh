#!/usr/bin/env bash
# Repair Apache after phase 6 on VirtualMin + nginx front (ports 80/443 owned by nginx).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/fix-apache-phase6.sh" >&2
  exit 1
fi

# shellcheck source=lib/fix-apache-nginx-ports.sh
source "$ROOT/scripts/lib/fix-apache-nginx-ports.sh"

echo "==> Apache repair (phase 6 / VirtualMin / nginx front)"

if a2query -M 2>/dev/null | grep -q mpm_prefork; then
  echo "    Reverting mpm_prefork → mpm_event (VirtualMin uses php-fpm)"
  a2dismod mpm_prefork 2>/dev/null || true
  a2dismod php8.1 2>/dev/null || true
  a2enmod mpm_event proxy_fcgi setenvif rewrite ssl 2>/dev/null || true
  a2enconf php8.1-fpm 2>/dev/null || true
fi

echo "==> ports.conf: only 127.0.0.1:8080 (nginx keeps :80 :443)"
fix_apache_listen_nginx_front

bash "$QADBAK_DIR/scripts/ensure-apache-backend.sh"

echo "==> Reload nginx"
nginx -t && systemctl reload nginx

echo "OK — Apache should listen only on 127.0.0.1:8080"
echo "    Test: curl -sI -H 'Host: siccamanagement.nl' http://127.0.0.1/ | head -5"
