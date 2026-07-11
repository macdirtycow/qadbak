#!/usr/bin/env bash
# Repair Qadbak hosting stack after an Ubuntu LTS release upgrade.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$(dirname "$SCRIPT_DIR")}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root." >&2
  exit 1
}

# shellcheck source=lib/linux-distro.sh
source "$SCRIPT_DIR/lib/linux-distro.sh"

qadbak_load_os_release || exit 1
if [[ "$QADBAK_OS_ID" != "ubuntu" ]]; then
  echo "Skip — not Ubuntu."
  exit 0
fi

echo "==> Post-release repair on $(qadbak_linux_release_label)"

export DEBIAN_FRONTEND=noninteractive
qadbak_pkg_update

if [[ -f "$QADBAK_DIR/scripts/install-native-stack.sh" ]]; then
  bash "$QADBAK_DIR/scripts/install-native-stack.sh"
fi

for svc in nginx apache2 mariadb postfix dovecot bind9; do
  systemctl enable "$svc" 2>/dev/null || true
  systemctl restart "$svc" 2>/dev/null || true
done

if [[ -f "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh" ]]; then
  bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh" || true
fi

if [[ -f "$QADBAK_DIR/scripts/repair-panel-access.sh" ]]; then
  bash "$QADBAK_DIR/scripts/repair-panel-access.sh" || true
fi

echo "OK — post-release repair complete"
