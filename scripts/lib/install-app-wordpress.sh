#!/bin/bash
# Install WordPress under a domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html}"
TARGET="$HOME_DIR/$SUB"
mkdir -p "$TARGET"
cd "$TARGET"
if command -v wp &>/dev/null; then
  wp core download --quiet
else
  curl -fsSL "https://wordpress.org/latest.tar.gz" | tar -xzf - --strip-components=1
fi
echo "OK — WordPress in $TARGET"
