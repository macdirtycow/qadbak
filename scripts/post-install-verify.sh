#!/usr/bin/env bash
# Full post-install verification: preflight, API, Playwright E2E on live panel.
# Called automatically by install/qadbak-install.sh.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
PORT="${PORT:-3000}"

echo "============================================"
echo " Qadbak post-install verification"
echo "============================================"

if [[ "$(id -un)" == "$USER" ]]; then
  cd "$ROOT"
  bash scripts/v1-test-preflight.sh
else
  sudo -u "$USER" bash -c "cd '$ROOT' && bash scripts/v1-test-preflight.sh"
fi

echo ""
echo "==> Health endpoint"
HEALTH="$(curl -sf "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || echo FAIL)"
echo "$HEALTH"
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "  OK   /api/health"
else
  echo "  FAIL /api/health"
  exit 1
fi
PROV="$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('provisioner',''))" 2>/dev/null || true)"
if [[ "$PROV" == "native" ]]; then
  echo "  OK   provisioner=native"
elif echo "$HEALTH" | grep -q '"mock":true'; then
  echo "  FAIL health still in mock mode on server" >&2
  exit 1
else
  echo "  OK   live mode (not mock)"
fi

if [[ -f "$ROOT/.env.local" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  echo ""
  echo "==> Panel URL"
  echo "  https://${QADBAK_PUBLIC_HOST:-localhost}/login"
fi

echo ""
echo "==> Playwright E2E (installed panel)"
if [[ -f "$ROOT/scripts/run-install-e2e.sh" ]]; then
  bash "$ROOT/scripts/run-install-e2e.sh"
else
  echo "  FAIL run-install-e2e.sh missing" >&2
  exit 1
fi

echo ""
echo "============================================"
echo " Post-install + E2E: PASSED"
echo " Optional manual checks: docs/E2E-CHECKLIST.md"
echo "   (create test domain, mail, DNS in the panel)"
echo "============================================"
