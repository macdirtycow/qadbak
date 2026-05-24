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
E2E_OK=0
if [[ "${QADBAK_SKIP_INSTALL_E2E:-}" == "1" ]]; then
  echo "==> Playwright E2E skipped (QADBAK_SKIP_INSTALL_E2E=1)"
  E2E_OK=1
elif [[ -f "$ROOT/scripts/run-install-e2e.sh" ]]; then
  echo "==> Playwright E2E (installed panel)"
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "  WARN install E2E skipped — Playwright system libs need root (qadbak has no sudo password):" >&2
    echo "    sudo bash $ROOT/scripts/run-install-e2e.sh" >&2
  elif bash "$ROOT/scripts/run-install-e2e.sh"; then
    E2E_OK=1
    echo "  OK   install E2E"
  else
    echo "  WARN install E2E failed (panel may still be fine — re-run as root):" >&2
    echo "    sudo bash $ROOT/scripts/run-install-e2e.sh" >&2
  fi
else
  echo "  WARN run-install-e2e.sh missing" >&2
fi

if [[ -f "$ROOT/scripts/check-native-mail.sh" ]]; then
  FIRST_DOMAIN="$(grep -o '"name":"[^"]*"' "$ROOT/data/native-domains.json" 2>/dev/null | head -1 | sed 's/"name":"//;s/"//')"
  if [[ -n "$FIRST_DOMAIN" ]]; then
    echo ""
    echo "==> Mail ($FIRST_DOMAIN)"
    bash "$ROOT/scripts/check-native-mail.sh" "$FIRST_DOMAIN" info 2>/dev/null || true
    bash "$ROOT/scripts/test-mail-receive.sh" "$FIRST_DOMAIN" info 2>/dev/null || echo "  WARN receive test — create mailbox info first"
  fi
fi

echo ""
echo "============================================"
if [[ "$E2E_OK" -eq 1 ]]; then
  echo " Post-install verification: PASSED"
else
  echo " Post-install verification: PASSED (E2E optional — see warning above)"
fi
echo " Optional manual checks: docs/E2E-CHECKLIST.md"
echo "   (create test domain, mail, DNS in the panel)"
echo "============================================"
