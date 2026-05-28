#!/bin/bash
# Install MediaWiki under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
MW_VERSION="${MEDIAWIKI_VERSION:-1.41.5}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi mediawiki "$TARGET/index.php" 2>/dev/null; then
  echo "MediaWiki already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://releases.wikimedia.org/mediawiki/1.41/mediawiki-${MW_VERSION}.tar.gz" -o "$TMP/mw.tar.gz"
tar -xzf "$TMP/mw.tar.gz" -C "$TMP"
cp -a "$TMP/mediawiki-${MW_VERSION}/"* "$TARGET/"
echo "OK — MediaWiki in $TARGET (open the site URL to run the installer)"
