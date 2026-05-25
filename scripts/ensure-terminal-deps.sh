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
  # Real smoke import using the EXACT resolution context that
  # scripts/domain-terminal-ws.mjs uses at runtime — i.e. createRequire
  # anchored at $ROOT/package.json plus `await import("jose")`. Anything
  # that loads via scripts/_check-terminal-deps.mjs will load in the real
  # pm2 spawn of qadbak-terminal; a previous inline `node --input-type=module
  # -e "await import('ws')"` smoke went through the cwd-based ESM resolver
  # and missed corrupt installs that ws@8's `exports`-routed require path
  # would still trip on. No 2>/dev/null: surface the Node error to the
  # operator on failure.
  run_as_qadbak "cd '$ROOT' && node '$ROOT/scripts/_check-terminal-deps.mjs'"
}

install_terminal_deps() {
  # Install the three packages by name so npm actually rewrites a corrupt
  # node_modules/<pkg>/ subtree. A bare `npm install` with no args treats
  # them as "already satisfied" by package-lock.json and skips the dir
  # even when its entrypoint files are gone, which is exactly the state
  # this script needs to recover from.
  echo "==> npm install ws node-pty jose (explicit, --no-audit --no-fund)"
  run_as_qadbak "cd '$ROOT' && npm install --no-audit --no-fund ws node-pty jose"
}

dump_diagnostics() {
  echo "==> Diagnostic: ls node_modules/{ws,node-pty,jose}" >&2
  for pkg in ws node-pty jose; do
    echo "  $pkg:" >&2
    ls -la "$ROOT/node_modules/$pkg/" 2>&1 | head -10 | sed 's/^/    /' >&2
  done
}

echo "==> Check terminal deps on disk (package.json + require.resolve)"
missing=()
for pkg in ws node-pty jose; do
  pkg_json="$ROOT/node_modules/$pkg/package.json"
  if [[ ! -s "$pkg_json" ]]; then
    missing+=("$pkg (no package.json)")
    continue
  fi
  # Definitive check: does Node itself resolve the package's entrypoint
  # from $ROOT, and does the resolved file exist on disk? Catches the
  # corrupt-install case where package.json is present but the main/exports
  # target was wiped (e.g. interrupted npm install, half-extracted tarball).
  if ! run_as_qadbak "node -e \"require('node:fs').accessSync(require.resolve('$pkg', { paths: ['$ROOT'] }))\"" >/dev/null 2>&1; then
    missing+=("$pkg (entrypoint unresolvable)")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "==> Missing or broken on disk: ${missing[*]}"
  install_terminal_deps
fi

echo "==> Smoke-import deps from scripts/domain-terminal-ws.mjs context"
if ! verify_terminal_imports; then
  echo "==> Smoke import failed — reinstalling deps" >&2
  install_terminal_deps
  echo "==> Smoke-import (retry after reinstall)"
  if ! verify_terminal_imports; then
    # pm2-restart-qadbak.sh catches a non-zero exit here and runs
    # scripts/repair-terminal-ws.sh automatically (npm install +
    # ensure-terminal-deps + pm2 restart) — see the trap on line ~47
    # of pm2-restart-qadbak.sh. If even that fails the operator gets
    # told to run apply-terminal-native.sh as the last resort.
    echo "==> FAIL — smoke import still failing; deps present on disk but unresolvable" >&2
    dump_diagnostics
    echo "    Fix: sudo bash scripts/apply-terminal-native.sh" >&2
    exit 1
  fi
fi

echo "    OK — terminal deps (ws, node-pty, jose)"
