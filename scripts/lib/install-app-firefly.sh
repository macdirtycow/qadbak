#!/bin/bash
# Install Firefly III personal finance under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/finance}"
TARGET="$HOME_DIR/$SUB"
FF_VERSION="${FIREFLY_VERSION:-6.6.3}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/public/index.php" ]] && grep -qi firefly "$TARGET/public/index.php" 2>/dev/null; then
  echo "Firefly III already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/firefly-iii/firefly-iii/releases/download/v${FF_VERSION}/FireflyIII-v${FF_VERSION}.zip" \
  -o "$TMP/firefly.zip"
unzip -q "$TMP/firefly.zip" -d "$TMP/extract"
if [[ -f "$TMP/extract/public/index.php" ]]; then
  cp -a "$TMP/extract/"* "$TARGET/"
else
  DIR="$(find "$TMP/extract" -maxdepth 1 -mindepth 1 -type d | head -1)"
  cp -a "$DIR/"* "$TARGET/"
fi
echo "OK — Firefly III in $TARGET (web root: .../finance/public — copy .env.example to .env)"
