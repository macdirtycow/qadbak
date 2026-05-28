#!/bin/bash
# Install Matomo under public_html (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/matomo}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
cd "$TARGET"
if [[ -f index.php ]] && grep -qi matomo index.php 2>/dev/null; then
  echo "Matomo already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://builds.matomo.org/matomo-latest.zip" -o "$TMP/matomo.zip"
unzip -q "$TMP/matomo.zip" -d "$TMP/extract"
cp -a "$TMP/extract/matomo/"* "$TARGET/"
echo "OK — Matomo in $TARGET (open web installer and use the database you created)"
