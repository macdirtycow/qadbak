#!/bin/bash
# Install LimeSurvey under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/limesurvey}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi limesurvey "$TARGET/index.php" 2>/dev/null; then
  echo "LimeSurvey already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://download.limesurvey.org/latest-master/limesurvey.zip" -o "$TMP/ls.zip"
unzip -q "$TMP/ls.zip" -d "$TMP/extract"
ROOT="$(find "$TMP/extract" -maxdepth 2 -name index.php -print -quit | xargs -r dirname)"
if [[ -z "$ROOT" ]]; then
  ROOT="$TMP/extract"
fi
cp -a "$ROOT/"* "$TARGET/"
echo "OK — LimeSurvey in $TARGET (open the installer wizard; use MySQL credentials from the panel)"
