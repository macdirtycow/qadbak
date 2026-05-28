#!/bin/bash
# Install Adminer (single-file DB UI) under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/adminer}"
TARGET="$HOME_DIR/$SUB"
ADMINER_VERSION="${ADMINER_VERSION:-4.8.1}"
mkdir -p "$TARGET"
OUT="$TARGET/index.php"
if [[ -f "$OUT" ]] && grep -qi adminer "$OUT" 2>/dev/null; then
  echo "Adminer already present at $OUT"
  exit 0
fi
curl -fsSL "https://github.com/vrana/adminer/releases/download/v${ADMINER_VERSION}/adminer-${ADMINER_VERSION}.php" -o "$OUT"
echo "OK — Adminer at https://your-domain/$(basename "$TARGET")/ — protect this URL (HTTP auth or IP allowlist)"
