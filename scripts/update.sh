#!/usr/bin/env bash
# Quick VPS update: git sync → build → restart (no full hosting stack / E2E).
# Run on the server as root:
#   sudo bash /opt/qadbak/scripts/update.sh
#
# For a full update (nginx, mail, backups, E2E): scripts/update-qadbak.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${QADBAK_DIR:-/opt/qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/update.sh" >&2
  exit 1
fi

exec bash "$SCRIPT_DIR/update-qadbak.sh" --quick "$@"
