#!/bin/bash
# Install DokuWiki (flat-file, no database) under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/wiki}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
if [[ -f "$TARGET/doku.php" ]]; then
  echo "DokuWiki already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://download.dokuwiki.org/src/dokuwiki/dokuwiki-stable.tgz" -o "$TMP/doku.tgz"
mkdir -p "$TMP/extract"
tar -xzf "$TMP/doku.tgz" -C "$TMP/extract"
DIR="$(find "$TMP/extract" -maxdepth 1 -type d -name 'dokuwiki-*' | head -1)"
if [[ -z "$DIR" ]]; then
  DIR="$(find "$TMP/extract" -maxdepth 1 -mindepth 1 -type d | head -1)"
fi
cp -a "$DIR/"* "$TARGET/"
echo "OK — DokuWiki in $TARGET (open the URL and run the setup wizard)"
