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

echo "==> Installing build-essential (make, g++) for node-pty"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y build-essential python3

echo "OK — node-pty can compile on this server"
