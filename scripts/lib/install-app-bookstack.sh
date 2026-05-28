#!/bin/bash
# Install BookStack under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/bookstack}"
TARGET="$HOME_DIR/$SUB"
BS_VERSION="${BOOKSTACK_VERSION:-24.12.1}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/public/index.php" ]]; then
  echo "BookStack already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/BookStackApp/BookStack/archive/refs/tags/v${BS_VERSION}.tar.gz" \
  -o "$TMP/bookstack.tar.gz"
mkdir -p "$TMP/extract"
tar -xzf "$TMP/bookstack.tar.gz" -C "$TMP/extract"
DIR="$TMP/extract/BookStack-${BS_VERSION}"
[[ -d "$DIR" ]] || DIR="$(find "$TMP/extract" -maxdepth 1 -mindepth 1 -type d | head -1)"
cp -a "$DIR/"* "$TARGET/"
echo "OK — BookStack in $TARGET (web root: .../bookstack/public — configure .env + database)"
