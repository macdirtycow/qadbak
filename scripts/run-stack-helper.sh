#!/bin/bash
# NOPASSWD sudo — stack helper (see configure-stack-helper-sudo.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QADBAK_NODE_BIN="${QADBAK_NODE_BIN:-$(command -v node 2>/dev/null || echo /usr/bin/node)}"
export QADBAK_DIR="${QADBAK_DIR:-$(dirname "$SCRIPT_DIR")}"
ALLOWLIST="$SCRIPT_DIR/lib/stack-helper-shell-commands.txt"
CMD="${1:-}"
if [[ -z "$CMD" ]] || ! grep -qxF "$CMD" "$ALLOWLIST" 2>/dev/null; then
  echo "Disallowed command: ${CMD:-(empty)}" >&2
  exit 1
fi
exec "$QADBAK_NODE_BIN" "$SCRIPT_DIR/stack-helper.mjs" "$@"
