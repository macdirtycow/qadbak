#!/usr/bin/env bash
# End-to-end license test on siccamanagement (local license server on :8787).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
ENV_FILE="${QADBAK_LICENSE_ENV:-/etc/qadbak/license-server.env}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
PORT="${LICENSE_PORT:-8787}"
KEY_FILE="${QADBAK_DIR}/data/.test-license-key"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "OK — $*"
}

echo "==> 1. License server health"
curl -sf "http://127.0.0.1:${PORT}/health" | grep -q '"ok"' || fail "License server not running — run: sudo bash $QADBAK_DIR/scripts/setup-local-license-server.sh"

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE"
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

echo "==> 2. Generate license key (or reuse $KEY_FILE)"
if [[ -f "$KEY_FILE" ]]; then
  LICENSE_KEY="$(tr -d '\n' <"$KEY_FILE")"
  pass "reusing saved key"
else
  RESP="$(curl -sf -X POST "http://127.0.0.1:${PORT}/v1/admin/keys" \
    -H "Authorization: Bearer ${LICENSE_ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"plan":"pro","features":["client-rbac","multi-tenant-clients","panel-client-vhost","admin-updates","php-fpm-isolation","dashboard-panel-control"],"maxDomains":50,"expiresAt":"2027-12-31T00:00:00.000Z","customerEmail":"siccamanagement-test"}')"
  LICENSE_KEY="$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).key)})")"
  [[ -n "$LICENSE_KEY" ]] || fail "Could not parse license key from server"
  mkdir -p "$QADBAK_DIR/data"
  echo "$LICENSE_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  chown "$QADBAK_USER:$QADBAK_USER" "$KEY_FILE"
  pass "new key written to $KEY_FILE"
fi

echo "==> 3. Panel .env.local license vars"
grep -q '^QADBAK_LICENSE_SERVER=' "$QADBAK_DIR/.env.local" || fail ".env.local missing QADBAK_LICENSE_SERVER"
grep -q '^QADBAK_LICENSE_JWT_SECRET=' "$QADBAK_DIR/.env.local" || fail ".env.local missing QADBAK_LICENSE_JWT_SECRET"
pass ".env.local configured"

echo "==> 4. Activate (CLI as $QADBAK_USER)"
sudo -u "$QADBAK_USER" bash -c "
  set -a
  source '$QADBAK_DIR/.env.local'
  set +a
  cd '$QADBAK_DIR'
  node scripts/qadbak-license-cli.mjs activate '$LICENSE_KEY'
" | grep -q '"ok":true' || fail "activate failed"

echo "==> 5. Heartbeat"
sudo -u "$QADBAK_USER" bash -c "
  set -a
  source '$QADBAK_DIR/.env.local'
  set +a
  cd '$QADBAK_DIR'
  node scripts/qadbak-license-cli.mjs heartbeat
" | grep -q '"ok":true' || fail "heartbeat failed"

echo "==> 6. Premium artifact (optional)"
PREMIUM_DIR="${QADBAK_PREMIUM_DIR:-/opt/qadbak-premium}"
ART_VER="0.1.0"
ART_PATH="$PREMIUM_DIR/license-server/data/artifacts/$ART_VER/premium.tar.gz"
if [[ -f "$ART_PATH" ]]; then
  pass "artifact present at $ART_PATH"
  sudo -u "$QADBAK_USER" bash -c "
    set -a
    source '$QADBAK_DIR/.env.local'
    export QADBAK_SKIP_SIGNATURE_VERIFY=true
    set +a
    cd '$QADBAK_DIR'
    node scripts/sync-premium-artifact.mjs
  " | grep -q '"ok":true' || fail "premium sync failed"
else
  echo "    SKIP — no $ART_PATH"
  echo "    Build on server: cd $PREMIUM_DIR && npm run build:release"
  echo "    Or test activate/heartbeat only in panel → Server admin → License"
fi

echo "==> 7. pm2 restart panel"
sudo -u "$QADBAK_USER" bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh" >/dev/null

echo ""
echo "Done. Open panel → Server admin → License — plan should show Premium (pro)."
echo "Test key (save securely): $LICENSE_KEY"
