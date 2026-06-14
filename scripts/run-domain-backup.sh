#!/usr/bin/env bash
# Cron / CLI: full Qadbak backup for one domain.
# Usage: run-domain-backup.sh example.com [full|web]
set -euo pipefail
DOMAIN="${1:?domain required}"
SCOPE="${2:-full}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export QADBAK_DIR="${QADBAK_DIR:-$(dirname "$SCRIPT_DIR")}"
HELPER="$SCRIPT_DIR/run-provisioning-helper.sh"
if [[ "$(id -u)" -eq 0 ]]; then
  exec "$HELPER" backup-create "$DOMAIN" "$SCOPE"
fi
exec sudo -n "$HELPER" backup-create "$DOMAIN" "$SCOPE"
