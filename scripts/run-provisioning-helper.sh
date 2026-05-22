#!/bin/bash
# NOPASSWD sudo — native provisioning (phase 8).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QADBAK_NODE_BIN="${QADBAK_NODE_BIN:-/usr/bin/node}"
export QADBAK_DIR="${QADBAK_DIR:-$(dirname "$SCRIPT_DIR")}"
ENV_FILE="$QADBAK_DIR/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi
exec "$QADBAK_NODE_BIN" "$SCRIPT_DIR/provisioning-helper.mjs" "$@"
