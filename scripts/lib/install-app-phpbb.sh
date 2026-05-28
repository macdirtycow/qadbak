#!/bin/bash
# Install phpBB under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
PHPBB_VERSION="${PHPBB_VERSION:-3.3.14}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi phpbb "$TARGET/index.php" 2>/dev/null; then
  echo "phpBB already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://download.phpbb.com/pub/release/3.3/${PHPBB_VERSION}/phpBB3.${PHPBB_VERSION}.zip" -o "$TMP/phpbb.zip"
unzip -q "$TMP/phpbb.zip" -d "$TMP/extract"
cp -a "$TMP/extract/phpBB3/"* "$TARGET/"
echo "OK — phpBB in $TARGET (open install/app.php or the site URL to finish setup)"
