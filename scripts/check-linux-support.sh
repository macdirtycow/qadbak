#!/usr/bin/env bash
# Verify this host is supported for Qadbak (native stack or panel-only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PANEL_ONLY=0
if [[ "${1:-}" == "--panel-only" ]]; then
  PANEL_ONLY=1
fi

# shellcheck source=lib/linux-distro.sh
source "$ROOT/scripts/lib/linux-distro.sh"

pass() { echo "  OK   $1"; }
fail() { echo "  FAIL $1"; FAILED=1; }
warn() { echo "  WARN $1"; }

FAILED=0

echo "==> Qadbak Linux support check"

if [[ "$PANEL_ONLY" -eq 1 ]]; then
  qadbak_load_os_release || true
  if [[ -n "$QADBAK_OS_PRETTY_NAME" ]]; then
    pass "OS: $QADBAK_OS_PRETTY_NAME"
  else
    warn "Could not read /etc/os-release — panel-only may still work with Node 20+"
  fi
  echo ""
  echo "==> Panel runtime"
  for cmd in node npm; do
    if command -v "$cmd" &>/dev/null; then
      pass "$cmd ($(command -v "$cmd"))"
    else
      warn "$cmd not installed yet (install Node.js 20+ or run install/qadbak-install-panel.sh)"
    fi
  done
  if command -v node &>/dev/null; then
    NODE_MAJOR="$(node -v | cut -d. -f1 | tr -d v)"
    if [[ "$NODE_MAJOR" -ge 20 ]]; then
      pass "Node.js $(node -v)"
    else
      fail "Node.js 20+ required (found $(node -v))"
    fi
  fi
  command -v pm2 &>/dev/null && pass pm2 || warn "pm2 not installed yet"
  echo ""
  if [[ "$FAILED" -eq 0 ]]; then
    echo "OK — host can run Qadbak panel-only (no native hosting stack)"
  else
    echo "FAIL — install Node.js 20+ before panel-only setup"
    exit 1
  fi
  exit 0
fi

if qadbak_detect_linux_distro; then
  pass "$(qadbak_linux_release_label) — native stack supported"
else
  fail "Unsupported OS for native install (need Ubuntu 22.04/24.04/26.04 or Debian 12)"
  echo ""
  echo "Tip: use panel-only on other Linux distros:"
  echo "  sudo bash install/qadbak-install-panel.sh"
  echo "  docs/LINUX-SUPPORT.md"
  exit 1
fi

echo ""
echo "==> Required commands"
for cmd in apt-get systemctl curl git nginx apache2 node npm; do
  if command -v "$cmd" &>/dev/null; then
    pass "$cmd"
  else
    warn "$cmd not installed yet (run install-native-stack.sh)"
  fi
done

echo ""
echo "==> BIND package names"
if apt-cache show bind9 &>/dev/null; then pass "bind9"; else fail "bind9 package missing"; fi
BIND_PKGS="$(qadbak_bind_apt_packages)"
if apt-cache show ${BIND_PKGS#bind9 } &>/dev/null 2>&1 || apt-cache show bind9-utils &>/dev/null || apt-cache show bind9utils &>/dev/null; then
  pass "BIND utils ($BIND_PKGS)"
else
  fail "Neither bind9utils nor bind9-utils found in apt"
fi

echo ""
echo "==> PHP-FPM versions"
FOUND=0
for v in 8.5 8.4 8.3 8.2 8.1; do
  if [[ -d "/etc/php/${v}/fpm" ]]; then
    pass "PHP ${v}-fpm"
    FOUND=1
  fi
done
[[ "$FOUND" -eq 1 ]] || warn "No /etc/php/*/fpm — install php-fpm"

echo ""
echo "==> Mail (optional)"
for svc in postfix dovecot; do
  systemctl is-active "$svc" &>/dev/null && pass "$svc active" || warn "$svc not active"
done

if [[ "$FAILED" -eq 0 ]]; then
  echo ""
  echo "OK — host looks compatible with Qadbak on $(qadbak_linux_release_label)"
else
  echo ""
  echo "FAIL — fix items above before production cutover"
  exit 1
fi
