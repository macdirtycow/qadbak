#!/bin/bash
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/nextcloud}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
cd "$TARGET"
curl -fsSL "https://download.nextcloud.com/server/releases/latest.zip" -o /tmp/nextcloud.zip
unzip -q /tmp/nextcloud.zip
shopt -s dotglob
mv nextcloud/* .
rmdir nextcloud 2>/dev/null || true
rm -f /tmp/nextcloud.zip
echo "OK — Nextcloud in $TARGET"
