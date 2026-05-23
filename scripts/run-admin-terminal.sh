#!/bin/bash
# Root shell for Qadbak admin terminal (invoked via sudo from qadbak user).
set -euo pipefail
TARGET="${QADBAK_ADMIN_TERMINAL_CWD:-/root}"
if [[ -d "$TARGET" ]]; then
  cd "$TARGET"
else
  cd /
fi
export HOME="${TARGET}"
exec /bin/bash -l
