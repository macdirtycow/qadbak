#!/bin/bash
# Install MyBB forum under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/forum}"
TARGET="$HOME_DIR/$SUB"
MYBB_VERSION="${MYBB_VERSION:-1839}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi mybb "$TARGET/index.php" 2>/dev/null; then
  echo "MyBB already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://resources.mybb.com/downloads/mybb_${MYBB_VERSION}.zip" -o "$TMP/mybb.zip"
unzip -q "$TMP/mybb.zip" -d "$TMP/extract"
if [[ -d "$TMP/extract/Upload" ]]; then
  cp -a "$TMP/extract/Upload/"* "$TARGET/"
else
  cp -a "$TMP/extract/"* "$TARGET/"
fi
echo "OK — MyBB in $TARGET (open install/ to finish setup)"
