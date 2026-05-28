#!/bin/bash
# Install Drupal from official zip (run as domain unix user — no composer required).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
DRUPAL_VERSION="${DRUPAL_VERSION:-10.3.6}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/web/index.php" ]] || [[ -f "$TARGET/index.php" && -d "$TARGET/core" ]]; then
  echo "Drupal already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://ftp.drupal.org/files/projects/drupal-${DRUPAL_VERSION}.zip" -o "$TMP/drupal.zip"
unzip -q "$TMP/drupal.zip" -d "$TMP/extract"
if [[ -d "$TMP/extract/drupal-${DRUPAL_VERSION}" ]]; then
  cp -a "$TMP/extract/drupal-${DRUPAL_VERSION}/"* "$TARGET/"
else
  cp -a "$TMP/extract/"* "$TARGET/"
fi
echo "OK — Drupal in $TARGET (open /core/install.php or site URL; document root is $SUB)"
