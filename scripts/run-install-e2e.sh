#!/usr/bin/env bash
# Playwright E2E against the running installed panel (post-install / installer).
# Browsers live under $ROOT/.cache/ms-playwright (owned by qadbak — never /root/.cache).
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
PORT="${PORT:-3000}"
PW_CACHE="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT/.cache/ms-playwright}"

E2E_ADMIN_USER="admin"
E2E_ADMIN_PASS=""
E2E_CLIENT_USER=""
E2E_CLIENT_PASS=""

if [[ -f "$ROOT/data/e2e-admin.pass" ]]; then
  E2E_ADMIN_PASS="$(head -1 "$ROOT/data/e2e-admin.pass" | tr -d '\r')"
fi

for cred_file in "$ROOT/.install-test.env" "$ROOT/.env.local"; do
  if [[ -f "$cred_file" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$cred_file"
    set +a
  fi
done

E2E_ADMIN_USER="${E2E_ADMIN_USER:-${QADBAK_E2E_ADMIN_USER:-admin}}"
E2E_ADMIN_PASS="${E2E_ADMIN_PASS:-${QADBAK_E2E_ADMIN_PASS:-}}"
E2E_ADMIN_PASS="${E2E_ADMIN_PASS//$'\r'/}"

if [[ -z "${E2E_ALLOW_MOCK:-}" ]] && [[ -f "$ROOT/.env.local" ]]; then
  INSTALL_MODE="$(grep '^QADBAK_INSTALL_MODE=' "$ROOT/.env.local" 2>/dev/null | cut -d= -f2- || true)"
  MOCK_MODE="$(grep '^QADBAK_LEGACY_API_MOCK=' "$ROOT/.env.local" 2>/dev/null | cut -d= -f2- | tr '[:upper:]' '[:lower:]' || true)"
  if [[ "$INSTALL_MODE" == "panel-only" && "$MOCK_MODE" == "true" ]]; then
    export E2E_ALLOW_MOCK=1
  fi
fi

if [[ -z "$E2E_ADMIN_PASS" ]] && [[ "$(id -u)" -eq 0 ]]; then
  bash "$ROOT/scripts/sync-e2e-credentials.sh" 2>/dev/null || \
    bash "$ROOT/scripts/ensure-install-test-env.sh" 2>/dev/null || true
  if [[ -f "$ROOT/.install-test.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.install-test.env"
    set +a
    E2E_ADMIN_PASS="${E2E_ADMIN_PASS//$'\r'/}"
  fi
fi

if [[ -z "$E2E_ADMIN_PASS" ]]; then
  echo "E2E_ADMIN_PASS missing." >&2
  echo "  Add to $ROOT/.install-test.env:" >&2
  echo "    E2E_ADMIN_USER=admin" >&2
  echo "    E2E_ADMIN_PASS=your-login-password" >&2
  echo "  Or QADBAK_E2E_ADMIN_PASS=... in .env.local" >&2
  exit 1
fi

export E2E_INSTALL_VERIFY=1
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${PORT}}"
export E2E_PORT="$PORT"
export E2E_ADMIN_USER E2E_ADMIN_PASS E2E_CLIENT_USER E2E_CLIENT_PASS
export PLAYWRIGHT_BROWSERS_PATH="$PW_CACHE"

run_as_user() {
  if [[ "$(id -un)" == "$USER" ]]; then
    env PLAYWRIGHT_BROWSERS_PATH="$PW_CACHE" "$@"
  else
    sudo -u "$USER" env PLAYWRIGHT_BROWSERS_PATH="$PW_CACHE" "$@"
  fi
}

if [[ ! -d "$ROOT/node_modules/@playwright/test" ]]; then
  echo "Installing npm dependencies (incl. dev)…" >&2
  run_as_user bash -c "cd '$ROOT' && npm install"
fi

mkdir -p "$PW_CACHE"
if [[ "$(id -u)" -eq 0 ]]; then
  chown -R "$USER:$USER" "$ROOT/.cache" 2>/dev/null || true
  echo "==> Playwright system libraries (root apt — qadbak has no sudo password)"
  # install-deps must run as root. Running as qadbak makes Playwright call sudo and hang/fail.
  (cd "$ROOT" && npx playwright install-deps chromium)
else
  echo "==> Playwright system libraries"
  if ! (cd "$ROOT" && npx playwright install-deps chromium); then
    echo "WARN: install-deps needs root once:" >&2
    echo "  sudo bash $ROOT/scripts/run-install-e2e.sh" >&2
  fi
fi

echo "==> Playwright Chromium (as $USER → $PW_CACHE)"
run_as_user bash -c "cd '$ROOT' && npx playwright install chromium"

if ! compgen -G "$PW_CACHE/chromium"* >/dev/null 2>&1; then
  echo "FAIL: Playwright browser not found under $PW_CACHE" >&2
  exit 1
fi

echo "==> Install E2E → $E2E_BASE_URL (user $E2E_ADMIN_USER)"
run_as_user env E2E_INSTALL_VERIFY=1 E2E_ALLOW_MOCK="${E2E_ALLOW_MOCK:-}" \
  E2E_BASE_URL="$E2E_BASE_URL" E2E_PORT="$E2E_PORT" \
  E2E_ADMIN_USER="$E2E_ADMIN_USER" E2E_ADMIN_PASS="$E2E_ADMIN_PASS" \
  E2E_CLIENT_USER="${E2E_CLIENT_USER:-}" E2E_CLIENT_PASS="${E2E_CLIENT_PASS:-}" \
  bash -c "cd '$ROOT' && npx playwright test e2e/install-verify.spec.ts"
