#!/bin/bash
# Install Joomla under public_html (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
cd "$TARGET"
if [[ -f index.php ]] && grep -q Joomla index.php 2>/dev/null; then
  echo "Joomla already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://downloads.joomla.org/cms/joomla5/5-0-3/Joomla_5.0.3-Stable-Full_Package.zip" -o "$TMP/joomla.zip"
unzip -q "$TMP/joomla.zip" -d "$TMP/extract"
cp -a "$TMP/extract/"* "$TARGET/"
echo "OK — Joomla in $TARGET (run web installer or configure configuration.php)"
