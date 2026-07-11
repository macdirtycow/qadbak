#!/usr/bin/env bash
# Build tools for native npm modules (node-pty for the Qadbak terminal).
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/install-node-build-deps.sh" >&2
  exit 1
fi

if command -v make &>/dev/null && command -v g++ &>/dev/null; then
  echo "OK — make and g++ already installed"
  exit 0
fi

# shellcheck source=lib/linux-distro.sh
source "$(dirname "$0")/lib/linux-distro.sh"
qadbak_load_os_release || true

echo "==> Installing build tools (make, g++) for node-pty"
if qadbak_has_apt; then
  qadbak_pkg_update
  qadbak_pkg_install build-essential python3
elif [[ "$QADBAK_PKG_MGR" == "dnf" ]] && command -v dnf &>/dev/null; then
  dnf groupinstall -y "Development Tools" || dnf install -y gcc-c++ make python3
else
  echo "WARN: install make and g++ manually for the native terminal (node-pty)" >&2
  exit 0
fi

echo "OK — node-pty can compile on this server"
