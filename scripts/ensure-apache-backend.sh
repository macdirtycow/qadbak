#!/usr/bin/env bash
# Start Apache (VirtualMin backend behind nginx). Exit 1 with diagnostics if it cannot run.
set -euo pipefail

APACHE_SVC=""
if systemctl list-unit-files apache2.service &>/dev/null 2>&1; then
  APACHE_SVC="apache2"
elif systemctl list-unit-files httpd.service &>/dev/null 2>&1; then
  APACHE_SVC="httpd"
fi

if [[ -z "$APACHE_SVC" ]]; then
  echo "No apache2/httpd systemd unit found." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/fix-apache-nginx-ports.sh
source "$ROOT/scripts/lib/fix-apache-nginx-ports.sh" 2>/dev/null || true

PORTS_CONF=""
[[ -f /etc/apache2/ports.conf ]] && PORTS_CONF="/etc/apache2/ports.conf"
[[ -f /etc/httpd/conf/ports.conf ]] && PORTS_CONF="/etc/httpd/conf/ports.conf"

fix_apache_ports_if_needed() {
  [[ -n "$PORTS_CONF" ]] || return 0
  if ss -ltn 2>/dev/null | grep -qE ':(80|443)[[:space:]]' && \
     grep -qE '^[[:space:]]*Listen[[:space:]]+(80|443|\[::\]:80|\[::\]:443)' "$PORTS_CONF" 2>/dev/null; then
    echo "==> nginx uses :80/:443 — Apache backend on 127.0.0.1:8080 only"
    fix_apache_listen_nginx_front
  elif ! grep -q '127.0.0.1:8080' "$PORTS_CONF" 2>/dev/null; then
    echo 'Listen 127.0.0.1:8080' >>"$PORTS_CONF"
  fi
}

echo "==> Apache backend ($APACHE_SVC)"
if [[ -n "$PORTS_CONF" ]]; then
  echo "    Listen directives:"
  grep -E '^Listen|^#Listen' "$PORTS_CONF" | sed 's/^/      /' || true
fi

if command -v apache2ctl &>/dev/null; then
  echo "==> apache2ctl configtest"
  if ! apache2ctl configtest 2>&1; then
    echo "    Fix Apache syntax errors above, then re-run repair." >&2
    exit 1
  fi
elif command -v apachectl &>/dev/null; then
  echo "==> apachectl configtest"
  if ! apachectl configtest 2>&1; then
    exit 1
  fi
fi

fix_apache_ports_if_needed

systemctl enable "$APACHE_SVC" 2>/dev/null || true
if ! systemctl is-active --quiet "$APACHE_SVC"; then
  echo "==> systemctl start $APACHE_SVC"
  if ! systemctl start "$APACHE_SVC" 2>&1; then
    echo "    FAILED to start $APACHE_SVC" >&2
    systemctl status "$APACHE_SVC" --no-pager -l 2>&1 | tail -20 || true
    journalctl -u "$APACHE_SVC" -n 30 --no-pager 2>&1 || true
    echo "" >&2
    echo "    Manual: sudo systemctl start $APACHE_SVC && sudo journalctl -xeu $APACHE_SVC" >&2
    exit 1
  fi
fi

if ss -ltn 2>/dev/null | grep -q '127.0.0.1:8080'; then
  echo "    OK — $APACHE_SVC active, listening 127.0.0.1:8080"
elif ss -ltn 2>/dev/null | grep -qE '127\.0\.0\.1:(8180|81|8000)'; then
  echo "    OK — $APACHE_SVC active (non-8080 loopback port — detect-web-backend will find it)"
else
  echo "    WARN — $APACHE_SVC is active but no loopback backend port seen (expected :8080)" >&2
  echo "    Check $PORTS_CONF and VirtualMin web settings." >&2
  exit 1
fi
