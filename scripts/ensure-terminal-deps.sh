#!/usr/bin/env bash
# Ensure ws, node-pty, and jose resolve for qadbak-terminal (ESM from scripts/).
# Run before pm2 restart. Never compile node-pty as root.
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

if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/fix-qadbak-ownership.sh" ]]; then
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
  bash "$ROOT/scripts/install-node-build-deps.sh" 2>/dev/null || true
fi

verify_terminal_imports() {
  run_as_qadbak "cd '$ROOT' && node --input-type=module -e \"
import('ws').then(() => import('node-pty')).then(() => import('jose')).then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
\""
}

install_terminal_deps() {
  echo "==> npm install (ws, node-pty, jose for terminal)"
  run_as_qadbak "cd '$ROOT' && npm install ws node-pty jose --no-audit --no-fund"
}

missing=()
for pkg in ws node-pty jose; do
  if [[ ! -e "$ROOT/node_modules/$pkg/package.json" ]]; then
    missing+=("$pkg")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "==> Missing on disk: ${missing[*]}"
  install_terminal_deps
fi

if ! verify_terminal_imports; then
  echo "==> Terminal import check failed — reinstalling deps"
  install_terminal_deps
  if ! verify_terminal_imports; then
    echo "FAIL — terminal deps still broken. Run as root:" >&2
    echo "  sudo bash scripts/apply-terminal-native.sh" >&2
    exit 1
  fi
fi

echo "    OK — terminal deps (ws, node-pty, jose)"
