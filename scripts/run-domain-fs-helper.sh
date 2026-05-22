#!/bin/bash
# NOPASSWD sudo entry for native Files (see configure-domain-fs-sudo.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="${QADBAK_NODE_BIN:-/usr/bin/node}"
exec "$NODE" "$SCRIPT_DIR/domain-fs-helper.mjs" "$@"
