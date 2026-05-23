#!/usr/bin/env bash
# Qadbak installer — native hosting stack (default, no VirtualMin/Webmin).
# Legacy VirtualMin GPL install: install/qadbak-install-virtualmin.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-install.sh" >&2
  exit 1
fi

echo ""
echo "  Qadbak install — native stack (nginx, Apache, MariaDB, mail, DNS)"
echo "  Does not install VirtualMin or Webmin."
echo "  Guide: docs/QADBAK-NATIVE-INSTALL.md"
echo ""
read -rp "Use legacy VirtualMin/Webmin installer instead? [y/N]: " USE_VM
if [[ "$USE_VM" =~ ^[Yy]$ ]]; then
  exec bash "$SCRIPT_DIR/qadbak-install-virtualmin.sh"
fi

exec bash "$SCRIPT_DIR/qadbak-install-native.sh"
