#!/bin/bash
# Install Moodle under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi moodle "$TARGET/index.php" 2>/dev/null; then
  echo "Moodle already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://download.moodle.org/download.php/direct/stable405/moodle-latest-405.tgz" -o "$TMP/moodle.tgz"
tar -xzf "$TMP/moodle.tgz" -C "$TMP"
cp -a "$TMP/moodle/"* "$TARGET/"
echo "OK — Moodle in $TARGET (complete the web installer with the MySQL credentials from the panel)"
