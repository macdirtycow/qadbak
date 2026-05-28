#!/bin/bash
# Install Drupal via composer project template (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
if [[ -f "$TARGET/web/index.php" ]] || [[ -f "$TARGET/index.php" && -d "$TARGET/core" ]]; then
  echo "Drupal already present in $TARGET"
  exit 0
fi
if ! command -v composer &>/dev/null; then
  echo "composer not found — install php-cli and composer on the host" >&2
  exit 1
fi
cd "$HOME_DIR"
composer create-project drupal/recommended-project:"^10" "$SUB" --no-interaction --quiet
echo "OK — Drupal in $TARGET (document root may be $SUB/web — adjust nginx if needed)"
