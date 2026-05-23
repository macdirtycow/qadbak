#!/usr/bin/env bash
# Ensure ws, node-pty, and jose exist for qadbak-terminal (ESM imports from scripts/).
# Run as qadbak user when possible — never npm rebuild node-pty as root.
set -euo pipefail

ROOT="${QADBAK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
USER="${QADBAK_USER:-qadbak}"

run_as_qadbak() {
  if [[ "$(id -un)" == "$USER" ]]; then
    bash -c "$1"
  else
    sudo -u "$USER" bash -c "$1"
  fi
}

missing=()
for pkg in ws node-pty jose; do
  if [[ ! -e "$ROOT/node_modules/$pkg/package.json" ]]; then
    missing+=("$pkg")
  fi
done

if [[ ${#missing[@]} -eq 0 ]]; then
  exit 0
fi

echo "==> Missing Node packages: ${missing[*]}"
if [[ "$(id -u)" -eq 0 ]]; then
  bash "$ROOT/scripts/install-node-build-deps.sh" 2>/dev/null || true
fi
run_as_qadbak "cd '$ROOT' && npm install"
echo "    OK   npm install (terminal deps)"
