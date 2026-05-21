#!/usr/bin/env bash
# Build nexmin-site-upload.zip (static-only fallback; prefer full Next.js deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/marketing-site"
OUT="$ROOT/dist/nexmin-site-upload.zip"
TMP="$(mktemp -d)"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
cp -R "$SITE/"* "$TMP/"
# Static hosts need relative asset paths (not /landing.css).
sed -i '' \
  -e 's|href="/landing.css"|href="assets/css/style.css"|g' \
  -e 's|src="/landing.js"|src="assets/js/main.js"|g' \
  -e 's|href="/favicon.svg"|href="assets/img/favicon.svg"|g' \
  -e 's|href="/login"|href="https://nexmin.net/login"|g' \
  "$TMP/index.html"
(cd "$TMP" && zip -r "$OUT" . -x "*.DS_Store")
rm -rf "$TMP"
echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
