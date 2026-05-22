#!/bin/bash
# NOPASSWD sudo entry for native Files (see configure-domain-fs-sudo.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Patched by configure-domain-fs-sudo.sh — must match pm2/qadbak node binary.
QADBAK_NODE_BIN="${QADBAK_NODE_BIN:-/usr/bin/node}"
exec "$QADBAK_NODE_BIN" "$SCRIPT_DIR/domain-fs-helper.mjs" "$@"
