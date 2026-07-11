#!/usr/bin/env bash
# Install Docker for Qadbak apps (Jellyfin, runtimes). Debian/Ubuntu via apt.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=linux-distro.sh
source "$SCRIPT_DIR/linux-distro.sh"

if command -v docker &>/dev/null && docker version &>/dev/null 2>&1; then
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/lib/ensure-docker.sh" >&2
  exit 1
fi

qadbak_load_os_release || true

case "$QADBAK_PKG_MGR" in
  apt)
    qadbak_pkg_update || apt-get update -qq
    if qadbak_pkg_install docker.io docker-compose-plugin 2>/dev/null; then
      :
    elif qadbak_pkg_install docker.io docker-compose-v2 2>/dev/null; then
      :
    else
      qadbak_pkg_install docker.io
    fi
    systemctl enable --now docker 2>/dev/null || true
    ;;
  dnf)
    dnf install -y docker docker-compose-plugin 2>/dev/null || dnf install -y docker
    systemctl enable --now docker 2>/dev/null || true
    ;;
  *)
    echo "Install Docker manually on this OS, then retry." >&2
    exit 1
    ;;
esac

command -v docker &>/dev/null || {
  echo "Docker install failed." >&2
  exit 1
}
