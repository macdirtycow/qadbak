#!/bin/bash
# Install Grav CMS (flat-file, no database) under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi grav "$TARGET/index.php" 2>/dev/null; then
  echo "Grav already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://getgrav.org/downloads/grav-admin.zip" -o "$TMP/grav.zip"
unzip -q "$TMP/grav.zip" -d "$TMP/extract"
if [[ -d "$TMP/extract/grav-admin" ]]; then
  cp -a "$TMP/extract/grav-admin/"* "$TARGET/"
else
  cp -a "$TMP/extract/"* "$TARGET/"
fi
echo "OK — Grav in $TARGET (open /admin to create your administrator account)"
