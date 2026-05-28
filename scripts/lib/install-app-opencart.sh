#!/bin/bash
# Install OpenCart 3 under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
OC_VERSION="${OPENCART_VERSION:-3.0.3.9}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi opencart "$TARGET/index.php" 2>/dev/null; then
  echo "OpenCart already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/opencart/opencart/releases/download/${OC_VERSION}/opencart-${OC_VERSION}.zip" -o "$TMP/oc.zip"
unzip -q "$TMP/oc.zip" -d "$TMP/extract"
if [[ -d "$TMP/extract/upload" ]]; then
  cp -a "$TMP/extract/upload/"* "$TARGET/"
else
  cp -a "$TMP/extract/"* "$TARGET/"
fi
echo "OK — OpenCart in $TARGET (run the web installer; use MySQL credentials from the panel)"
