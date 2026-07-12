#!/usr/bin/env bash
# Regenerate all Qadbak sudoers (run as root after git pull or new domains).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
export QADBAK_DIR="${QADBAK_DIR:-$ROOT}"
for s in \
  configure-provisioning-helper-sudo.sh \
  configure-stack-helper-sudo.sh \
  configure-host-services-sudo.sh \
  configure-updates-sudo.sh \
  configure-domain-fs-sudo.sh \
  configure-panel-pm2-sudo.sh \
  configure-backup-download-sudo.sh \
  configure-domain-terminal-sudo.sh \
  configure-php-fpm-sudo.sh \
  configure-panel-vhost-sudo.sh \
  configure-domain-repair-sudo.sh \
  configure-admin-terminal-sudo.sh; do
  echo "==> $s"
  bash "$ROOT/scripts/$s"
done
bash "$ROOT/scripts/check-sudoers-no-broad-wildcards.sh"
echo "OK — all qadbak sudoers regenerated"
