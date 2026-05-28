#!/bin/bash
# Install Kanboard under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/kanboard}"
TARGET="$HOME_DIR/$SUB"
KB_VERSION="${KANBOARD_VERSION:-1.2.44}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi kanboard "$TARGET/index.php" 2>/dev/null; then
  echo "Kanboard already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/kanboard/kanboard/releases/download/v${KB_VERSION}/kanboard-${KB_VERSION}.zip" -o "$TMP/kb.zip"
unzip -q "$TMP/kb.zip" -d "$TMP/extract"
cp -a "$TMP/extract/"* "$TARGET/"
echo "OK — Kanboard in $TARGET (default login admin / admin — change immediately)"
