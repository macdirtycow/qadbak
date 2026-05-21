#!/usr/bin/env bash
# Build nexmin-site-upload.zip for static hosting (nexmin.net root).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/marketing-site"
OUT="$ROOT/dist/nexmin-site-upload.zip"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
(cd "$SITE" && zip -r "$OUT" . -x "*.DS_Store")
echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
