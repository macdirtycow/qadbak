#!/bin/bash
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/phpmyadmin}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
cd "$TARGET"
VER="${PHPMYADMIN_VERSION:-5.2.1}"
curl -fsSL "https://files.phpmyadmin.net/phpMyAdmin/${VER}/phpMyAdmin-${VER}-all-languages.tar.xz" \
  | tar -xJ --strip-components=1
echo "OK — phpMyAdmin in $TARGET"
