#!/usr/bin/env bash
# Safe git pull on VPS: reset drift files, pull, re-apply sudo helpers.
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
cd "$QADBAK_DIR"

bash "$QADBAK_DIR/scripts/reset-git-drift-before-pull.sh"
git pull --ff-only
bash "$QADBAK_DIR/scripts/fix-qadbak-ownership.sh"

if [[ "$(id -u)" -eq 0 ]]; then
  for h in configure-provisioning-helper-sudo.sh configure-stack-helper-sudo.sh; do
    bash "$QADBAK_DIR/scripts/$h" || echo "WARN: $h" >&2
  done
  if [[ -f "$QADBAK_DIR/scripts/apply-terminal-native.sh" ]]; then
    bash "$QADBAK_DIR/scripts/apply-terminal-native.sh"
  fi
fi

echo "OK — pull complete. Run: sudo bash scripts/discover-mail-layout.sh <domain>"
