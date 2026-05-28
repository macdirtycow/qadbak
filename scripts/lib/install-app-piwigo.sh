#!/bin/bash
# Install Piwigo photo gallery under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/gallery}"
TARGET="$HOME_DIR/$SUB"
PIWIGO_VERSION="${PIWIGO_VERSION:-16.4.0}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi piwigo "$TARGET/index.php" 2>/dev/null; then
  echo "Piwigo already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/Piwigo/Piwigo/archive/refs/tags/${PIWIGO_VERSION}.zip" -o "$TMP/piwigo.zip"
unzip -q "$TMP/piwigo.zip" -d "$TMP/extract"
DIR="$TMP/extract/Piwigo-${PIWIGO_VERSION}"
[[ -d "$DIR" ]] || DIR="$(find "$TMP/extract" -maxdepth 1 -mindepth 1 -type d | head -1)"
cp -a "$DIR/"* "$TARGET/"
echo "OK — Piwigo in $TARGET (run the web installer — MySQL database required)"
