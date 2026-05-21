#!/usr/bin/env bash
# Copy marketing assets into public/ for Next.js (/, /landing.css, /landing.js).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/marketing-site"
PUB="$ROOT/public"
mkdir -p "$PUB"
cp "$SITE/assets/css/style.css" "$PUB/landing.css"
cp "$SITE/assets/js/main.js" "$PUB/landing.js"
cp "$SITE/assets/img/favicon.svg" "$PUB/favicon.svg"
