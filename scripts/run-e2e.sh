#!/usr/bin/env bash
# Stable Playwright E2E (mock VirtualMin). Does not touch a real VPS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export SESSION_SECRET="${SESSION_SECRET:-e2e-test-secret-minimum-16-chars}"
export VIRTUALMIN_MOCK=true
export E2E_PORT="${E2E_PORT:-3099}"

if [[ ! -d node_modules/@playwright/test ]]; then
  npm install
fi

if ! npx playwright --version &>/dev/null; then
  echo "Installing @playwright/test…" >&2
  npm install -D @playwright/test@1.51.1
fi

echo "==> Playwright browsers (chromium)"
npx playwright install chromium

echo "==> E2E tests (mock mode, port $E2E_PORT)"
npx playwright test "$@"
