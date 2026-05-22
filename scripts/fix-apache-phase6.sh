#!/usr/bin/env bash
# Repair Apache after install-native-stack.sh on an existing VirtualMin VPS.
# Restores mpm_event + php-fpm (undoes harmful mpm_prefork switch) and backend :8080.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/fix-apache-phase6.sh" >&2
  exit 1
fi

echo "==> Apache repair (phase 6 / VirtualMin)"

if a2query -M 2>/dev/null | grep -q mpm_prefork; then
  echo "    Reverting mpm_prefork → mpm_event (VirtualMin uses php-fpm)"
  a2dismod mpm_prefork 2>/dev/null || true
  a2dismod php8.1 2>/dev/null || true
  a2enmod mpm_event proxy_fcgi setenvif rewrite ssl 2>/dev/null || true
  a2enconf php8.1-fpm 2>/dev/null || true
fi

if [[ -f /etc/apache2/ports.conf ]]; then
  if grep -qE '^Listen[[:space:]]+80[[:space:]]*$' /etc/apache2/ports.conf; then
    if ss -ltn 2>/dev/null | grep -qE ':80[[:space:]]'; then
      echo "    ports.conf: disable Listen 80 (nginx owns :80)"
      cp -a /etc/apache2/ports.conf "/etc/apache2/ports.conf.bak.qadbak.$(date +%s)"
      sed -i 's/^Listen 80$/#Listen 80 # qadbak: nginx front/' /etc/apache2/ports.conf
    fi
  fi
  if ! grep -q '127.0.0.1:8080' /etc/apache2/ports.conf; then
    echo 'Listen 127.0.0.1:8080' >>/etc/apache2/ports.conf
  fi
fi

bash "$QADBAK_DIR/scripts/ensure-apache-backend.sh"

echo "==> Reload nginx"
nginx -t && systemctl reload nginx

echo "OK — Apache backend repaired. Re-run: sudo bash scripts/apply-phase6-test-server.sh (or update-qadbak.sh)"
