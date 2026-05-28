#!/bin/bash
# Install osTicket helpdesk under domain home (run as domain unix user).
set -euo pipefail
HOME_DIR="${1:?home}"
SUB="${2:-public_html/support}"
TARGET="$HOME_DIR/$SUB"
OST_VERSION="${OSTICKET_VERSION:-1.18.1}"
mkdir -p "$TARGET"
if [[ -f "$TARGET/index.php" ]] && grep -qi osticket "$TARGET/index.php" 2>/dev/null; then
  echo "osTicket already present in $TARGET"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/osTicket/osTicket/releases/download/v${OST_VERSION}/osTicket-v${OST_VERSION}.zip" \
  -o "$TMP/ost.zip"
unzip -q "$TMP/ost.zip" -d "$TMP/extract"
if [[ -d "$TMP/extract/upload" ]]; then
  cp -a "$TMP/extract/upload/"* "$TARGET/"
else
  cp -a "$TMP/extract/"* "$TARGET/"
fi
echo "OK — osTicket in $TARGET (open setup/ to finish installation)"
