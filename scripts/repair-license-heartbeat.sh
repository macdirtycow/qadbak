#!/usr/bin/env bash
# Fix panel ↔ license.inveil.dev connectivity and heartbeat.
# Usage: sudo bash scripts/repair-license-heartbeat.sh
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
ENV_FILE="$ROOT/.env.local"
CANONICAL_URL="https://license.inveil.dev"
JWT_ARG="${1:-}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

upsert_env() {
  local key="$1" val="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
  chown "$USER:$USER" "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$ENV_FILE" 2>/dev/null || true
}

remove_env_key() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  grep -v "^${key}=" "$ENV_FILE" >"${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
  chown "$USER:$USER" "$ENV_FILE" 2>/dev/null || true
}

echo "==> License server URL (.env.local)"
if [[ -f "$ENV_FILE" ]]; then
  grep -E '^(QADBAK_LICENSE_SERVER|QADBAK_LICENSE_SERVER_INTERNAL|QADBAK_LICENSE_JWT_SECRET)=' \
    "$ENV_FILE" 2>/dev/null || echo "  (missing license keys)"
else
  echo "  WARN: $ENV_FILE missing" >&2
fi

CURRENT_URL="$(grep '^QADBAK_LICENSE_SERVER=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
CURRENT_URL="${CURRENT_URL%/}"
if [[ -z "$CURRENT_URL" ]]; then
  echo "==> Set QADBAK_LICENSE_SERVER=$CANONICAL_URL"
  upsert_env QADBAK_LICENSE_SERVER "$CANONICAL_URL"
elif [[ "$CURRENT_URL" != "$CANONICAL_URL" ]]; then
  if ! curl -sf --max-time 8 "${CURRENT_URL}/health" 2>/dev/null | grep -q '"ok"'; then
    echo "==> Replace stale QADBAK_LICENSE_SERVER ($CURRENT_URL → $CANONICAL_URL)"
    upsert_env QADBAK_LICENSE_SERVER "$CANONICAL_URL"
  fi
fi

INTERNAL="$(grep '^QADBAK_LICENSE_SERVER_INTERNAL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [[ -n "$INTERNAL" ]]; then
  echo "==> QADBAK_LICENSE_SERVER_INTERNAL=$INTERNAL"
  if curl -sf --max-time 5 "${INTERNAL%/}/health" 2>/dev/null | grep -q '"ok"'; then
    echo "  OK — internal URL responds"
  else
    echo "  WARN — internal URL unreachable; removing (use public license host instead)"
    remove_env_key QADBAK_LICENSE_SERVER_INTERNAL
  fi
fi

echo ""
echo "==> Health check: $CANONICAL_URL/health"
if curl -sf --max-time 10 "$CANONICAL_URL/health" | tee /tmp/qadbak-license-health.json | grep -q '"ok"'; then
  echo "  OK"
else
  echo "  FAIL — license server not reachable from this VPS" >&2
  echo "  Fix license host first (pm2 qadbak-license on license VPS, DNS, firewall)." >&2
  exit 1
fi

if [[ -n "$JWT_ARG" ]]; then
  echo ""
  echo "==> Set QADBAK_LICENSE_JWT_SECRET from argument"
  upsert_env QADBAK_LICENSE_JWT_SECRET "$JWT_ARG"
elif ! grep -q '^QADBAK_LICENSE_JWT_SECRET=' "$ENV_FILE" 2>/dev/null; then
  echo ""
  echo "  WARN — QADBAK_LICENSE_JWT_SECRET missing (heartbeat still runs; crypto verify stays off)" >&2
  echo "  Copy from license VPS: grep LICENSE_JWT_SECRET /etc/qadbak/license-server.env" >&2
  echo "  Then: sudo bash $0 'YOUR_SECRET'" >&2
fi

if [[ ! -f "$ROOT/data/license.json" ]]; then
  echo ""
  echo "  No data/license.json — activate a key first:" >&2
  echo "  sudo bash scripts/activate-panel-license.sh QAD-XXXX-XXXX-XXXX" >&2
  exit 1
fi

echo ""
echo "==> Heartbeat"
set +e
HB_OUT="$(sudo -u "$USER" bash -c "set -a && source '$ENV_FILE' && set +a && node '$ROOT/scripts/qadbak-license-cli.mjs' heartbeat" 2>&1)"
HB_RC=$?
set -e
echo "$HB_OUT"

if [[ "$HB_RC" -ne 0 ]]; then
  echo "" >&2
  if grep -q 'Not found' <<<"$HB_OUT"; then
    echo "  Hint: 'Not found' usually means the panel hits the wrong host/path." >&2
    echo "  Ensure QADBAK_LICENSE_SERVER=$CANONICAL_URL (no /buy suffix)." >&2
    echo "  Remove QADBAK_LICENSE_SERVER_INTERNAL unless license API runs on this same box." >&2
  fi
  if grep -qi 'invalid token\|401\|403' <<<"$HB_OUT"; then
    echo "  Hint: re-activate with your QAD- key (JWT secret mismatch or stale token)." >&2
    echo "  sudo bash scripts/activate-panel-license.sh QAD-..." >&2
  fi
  exit "$HB_RC"
fi

echo ""
echo "==> Restart panel"
bash "$ROOT/scripts/pm2-restart-qadbak.sh"

if [[ -f "$ROOT/scripts/configure-license-heartbeat-timer.sh" ]]; then
  bash "$ROOT/scripts/configure-license-heartbeat-timer.sh" || true
fi

echo "OK — heartbeat restored"
