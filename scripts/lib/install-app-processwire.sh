#!/bin/bash
# Install ProcessWire CMS under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
PW_VERSION="${PROCESSWIRE_VERSION:-3.0.246}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi processwire "$TARGET/index.php" 2>/dev/null; then
  echo "ProcessWire already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/processwire/processwire/archive/refs/tags/${PW_VERSION}.zip" \
  -o "$TMP/pw.zip"
unzip -q "$TMP/pw.zip" -d "$TMP/extract"
DIR="$TMP/extract/processwire-${PW_VERSION}"
[[ -d "$DIR" ]] || DIR="$(find "$TMP/extract" -maxdepth 1 -mindepth 1 -type d | head -1)"
cp -a "$DIR/"* "$TARGET/"
echo "OK — ProcessWire in $TARGET (open the site URL to run the installer)"
