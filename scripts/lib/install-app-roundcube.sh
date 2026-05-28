#!/bin/bash
# Install Roundcube webmail under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/roundcube}"
TARGET="$HOME_DIR/$SUB"
RC_VERSION="${ROUNDCUBE_VERSION:-1.6.9}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi roundcube "$TARGET/index.php" 2>/dev/null; then
  echo "Roundcube already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/roundcube/roundcubemail/releases/download/${RC_VERSION}/roundcubemail-${RC_VERSION}-complete.tar.gz" \
  -o "$TMP/rc.tar.gz"
mkdir -p "$TMP/extract"
tar -xzf "$TMP/rc.tar.gz" -C "$TMP/extract"
DIR="$(find "$TMP/extract" -maxdepth 1 -type d -name 'roundcubemail-*' | head -1)"
if [[ -z "$DIR" ]]; then
  DIR="$(find "$TMP/extract" -maxdepth 1 -mindepth 1 -type d | head -1)"
fi
cp -a "$DIR/"* "$TARGET/"
echo "OK — Roundcube in $TARGET (complete installer — configure database in the web installer)"
