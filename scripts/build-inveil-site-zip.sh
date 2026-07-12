#!/usr/bin/env bash
# Build inveil-site.zip for static upload to inveil.net web root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/inveil-site"
OUT="$ROOT/dist/inveil-site-upload.zip"
TMP="$(mktemp -d)"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
cp -R "$SITE/"* "$TMP/"
( cd "$TMP" && zip -qr "$OUT" . -x "*.DS_Store" )
rm -rf "$TMP"
echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
