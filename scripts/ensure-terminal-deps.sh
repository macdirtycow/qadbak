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
  # Real ESM smoke import: this matches the resolution path that
  # scripts/domain-terminal-ws.mjs uses at runtime (await import + createRequire
  # both flow through Node's module resolver from $ROOT). A bare
  # `npm ls ws` or `node_modules/ws/package.json` check is too weak —
  # npm ci can leave the tree in a state where `import "ws"` from a
  # scripts/*.mjs file fails with ERR_MODULE_NOT_FOUND while the package
  # is technically present on disk. Run from $ROOT (pm2/Node also launch
  # qadbak-terminal from $ROOT) so module resolution sees the same cwd.
  # No 2>/dev/null: surface the Node error to the operator on failure.
  run_as_qadbak "cd '$ROOT' && node --input-type=module -e \"
await import('ws');
await import('node-pty');
await import('jose');
console.log('OK — ws + node-pty + jose import cleanly');
\""
}

install_terminal_deps() {
  echo "==> npm install (panel + terminal deps)"
  run_as_qadbak "cd '$ROOT' && npm install --no-audit --no-fund"
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

echo "==> Smoke-import deps from scripts/domain-terminal-ws.mjs context"
if ! verify_terminal_imports; then
  echo "    smoke import failed — reinstalling deps" >&2
  install_terminal_deps
  echo "==> Smoke-import (retry after reinstall)"
  if ! verify_terminal_imports; then
    # pm2-restart-qadbak.sh catches a non-zero exit here and runs
    # scripts/repair-terminal-ws.sh automatically (npm install +
    # ensure-terminal-deps + pm2 restart) — see the trap on line ~47
    # of pm2-restart-qadbak.sh. If even that fails the operator gets
    # told to run apply-terminal-native.sh as the last resort.
    echo "    FAIL — smoke import still failing; deps present on disk but unresolvable" >&2
    echo "    Fix: sudo bash scripts/apply-terminal-native.sh" >&2
    exit 1
  fi
fi

echo "    OK — terminal deps (ws, node-pty, jose)"
