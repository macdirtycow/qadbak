#!/usr/bin/env bash
# Test create-login-link without json/multiline (fixes "Unknown parameter --multiline").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${VIRTUALMIN_URL:?}"
: "${VIRTUALMIN_USER:?}"
: "${VIRTUALMIN_PASS:?}"

DOMAIN="${1:-siccamanagement.nl}"

echo "==> Plain create-login-link (no json, no multiline)"
curl -sk -u "${VIRTUALMIN_USER}:${VIRTUALMIN_PASS}" -X POST \
  --data-urlencode "program=create-login-link" \
  --data-urlencode "domain=${DOMAIN}" \
  --data-urlencode "redirect-url=/filemin/index.cgi" \
  "${VIRTUALMIN_URL}" | head -c 2000
echo ""
echo ""
echo "OK if you see a https:// URL above (no 'Unknown parameter')."
