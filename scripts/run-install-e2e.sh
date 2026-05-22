#!/usr/bin/env bash
# Playwright E2E against the running installed panel (post-install / installer).
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
PORT="${PORT:-3000}"

if [[ -f "$ROOT/.install-test.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.install-test.env"
  set +a
elif [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
  export E2E_ADMIN_USER="${E2E_ADMIN_USER:-${QADBAK_E2E_ADMIN_USER:-admin}}"
  export E2E_ADMIN_PASS="${E2E_ADMIN_PASS:-${QADBAK_E2E_ADMIN_PASS:-}}"
fi

if [[ -z "${E2E_ADMIN_PASS:-}" ]] && [[ "$(id -u)" -eq 0 ]]; then
  bash "$ROOT/scripts/ensure-install-test-env.sh" 2>/dev/null || true
  if [[ -f "$ROOT/.install-test.env" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT/.install-test.env"
  fi
fi

: "${E2E_ADMIN_PASS:?E2E_ADMIN_PASS missing — run via install, .install-test.env, or QADBAK_E2E_ADMIN_PASS in .env.local}"

export E2E_INSTALL_VERIFY=1
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${PORT}}"
export E2E_PORT="$PORT"

cd "$ROOT"

if [[ ! -d node_modules/@playwright/test ]]; then
  echo "Installing npm dependencies (incl. dev)…" >&2
  if [[ "$(id -un)" == "$USER" ]]; then
    npm install
  else
    sudo -u "$USER" npm install
  fi
fi

if [[ "$(id -u)" -eq 0 ]] && ! [[ -d "$HOME/.cache/ms-playwright" ]] && ! sudo -u "$USER" test -d "/home/$USER/.cache/ms-playwright" 2>/dev/null; then
  echo "==> Playwright Chromium (system deps)"
  npx playwright install chromium --with-deps
fi

run_as_user() {
  if [[ "$(id -un)" == "$USER" ]]; then
    "$@"
  else
    sudo -u "$USER" -E "$@"
  fi
}

run_as_user env E2E_INSTALL_VERIFY=1 E2E_BASE_URL="$E2E_BASE_URL" E2E_PORT="$E2E_PORT" \
  E2E_ADMIN_USER="${E2E_ADMIN_USER:-admin}" E2E_ADMIN_PASS="$E2E_ADMIN_PASS" \
  E2E_CLIENT_USER="${E2E_CLIENT_USER:-}" E2E_CLIENT_PASS="${E2E_CLIENT_PASS:-}" \
  bash -c "cd '$ROOT' && npx playwright install chromium 2>/dev/null || true"

echo "==> Install E2E → $E2E_BASE_URL"
run_as_user env E2E_INSTALL_VERIFY=1 E2E_BASE_URL="$E2E_BASE_URL" E2E_PORT="$E2E_PORT" \
  E2E_ADMIN_USER="${E2E_ADMIN_USER:-admin}" E2E_ADMIN_PASS="$E2E_ADMIN_PASS" \
  E2E_CLIENT_USER="${E2E_CLIENT_USER:-}" E2E_CLIENT_PASS="${E2E_CLIENT_PASS:-}" \
  npx playwright test e2e/install-verify.spec.ts
