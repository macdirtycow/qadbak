#!/usr/bin/env bash
# Build qadbak-site-upload.zip (static-only fallback; prefer full Next.js deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/marketing-site"
OUT="$ROOT/dist/qadbak-site-upload.zip"
TMP="$(mktemp -d)"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
cp -R "$SITE/"* "$TMP/"
# Static hosts need relative asset paths (not /landing.css).
sed -i '' \
  -e 's|href="/landing.css"|href="assets/css/style.css"|g' \
  -e 's|src="/landing.js"|src="assets/js/main.js"|g' \
  -e 's|href="/favicon.svg"|href="assets/img/favicon.svg"|g' \
  -e 's|href="/login"|href="https://qadbak.com/login"|g' \
  -e 's|<head>|<head>\n    <link rel="canonical" href="https://qadbak.com/" />|' \
  "$TMP/index.html"
# Refresh CSS/JS from Next.js public assets when present
if [[ -f "$ROOT/public/landing.css" ]]; then
  cp "$ROOT/public/landing.css" "$TMP/assets/css/style.css"
fi
if [[ -f "$ROOT/public/landing.js" ]]; then
  cp "$ROOT/public/landing.js" "$TMP/assets/js/main.js"
fi
(cd "$TMP" && zip -r "$OUT" . -x "*.DS_Store")
rm -rf "$TMP"
echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
