#!/usr/bin/env bash
# Start production Next.js for Playwright (mock mode, isolated port).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export SESSION_SECRET="${SESSION_SECRET:-e2e-test-secret-minimum-32-characters-long}"
export QADBAK_ALLOW_WEAK_PASSWORDS="${QADBAK_ALLOW_WEAK_PASSWORDS:-true}"
export QADBAK_HEALTH_MINIMAL="${QADBAK_HEALTH_MINIMAL:-false}"
export QADBAK_LEGACY_API_MOCK="${QADBAK_LEGACY_API_MOCK:-true}"
export PORT="${E2E_PORT:-3099}"
export QADBAK_PUBLIC_HOST="${QADBAK_PUBLIC_HOST:-localhost}"

mkdir -p data
cp -f data/users.example.json data/users.json
rm -f data/api-rate-buckets.json
rm -rf data/rate-buckets

echo "==> E2E production build"
npm run build

exec npm run start
