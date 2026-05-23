#!/usr/bin/env bash
# Qadbak installer — native hosting stack (no control-panel packages).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-install.sh" >&2
  exit 1
fi

exec bash "$SCRIPT_DIR/qadbak-install-native.sh"
