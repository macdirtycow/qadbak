#!/usr/bin/env bash
# Restart Qadbak with .env.local loaded into pm2 (fixes empty domain list in UI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER="${QADBAK_USER:-qadbak}"

run() {
  if [[ "$(id -un)" == "$USER" ]]; then
    bash -c "$1"
  else
    sudo -u "$USER" bash -c "$1"
  fi
}

if [[ ! -f "$ROOT/.env.local" ]]; then
  echo "Missing $ROOT/.env.local" >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/fix-qadbak-ownership.sh" ]]; then
  bash "$ROOT/scripts/fix-qadbak-ownership.sh"
fi

if [[ ! -f "$ROOT/.next/BUILD_ID" ]]; then
  echo "Missing production build — run: sudo -u $USER bash -c 'cd $ROOT && npm run build'" >&2
  exit 1
fi

PROV="$(grep -E '^QADBAK_PROVISIONER=' "$ROOT/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [[ "$PROV" != "native" ]] && ! grep -q '^QADBAK_LEGACY_API_TLS_INSECURE=' "$ROOT/.env.local"; then
  echo 'QADBAK_LEGACY_API_TLS_INSECURE=true' >>"$ROOT/.env.local"
  chown "$USER:$USER" "$ROOT/.env.local" 2>/dev/null || true
fi

LOCK_STAMP="$ROOT/node_modules/.package-lock.sha256"
LOCK_HASH=""
if [[ -f "$ROOT/package-lock.json" ]]; then
  LOCK_HASH="$(sha256sum "$ROOT/package-lock.json" | awk '{print $1}')"
fi
if [[ -n "$LOCK_HASH" && "$(cat "$LOCK_STAMP" 2>/dev/null || true)" != "$LOCK_HASH" ]]; then
  echo "==> package-lock.json changed — npm install"
  run "cd '$ROOT' && npm install --no-audit --no-fund"
  run "mkdir -p '$ROOT/node_modules' && echo '$LOCK_HASH' > '$LOCK_STAMP'"
fi

if ! bash "$ROOT/scripts/ensure-terminal-deps.sh"; then
  echo "==> Terminal deps repair"
  bash "$ROOT/scripts/repair-terminal-ws.sh" || true
fi

echo "==> pm2 restart with ecosystem (.env.local → process env)"
run "cd '$ROOT' && pm2 delete qadbak qadbak-terminal 2>/dev/null || true"
run "cd '$ROOT' && pm2 start ecosystem.config.cjs"
run "cd '$ROOT' && pm2 save"

TERMINAL_PORT="3001"
if [[ -f "$ROOT/.env.local" ]]; then
  TERMINAL_PORT="$(grep -E '^QADBAK_TERMINAL_WS_PORT=' "$ROOT/.env.local" | cut -d= -f2- | tr -d '"' || echo 3001)"
fi

echo "==> Quick API check"
sleep 2
curl -sf "http://127.0.0.1:3000/api/health" | head -c 120 || true
echo ""

if [[ -f "$ROOT/data/license.json" ]]; then
  echo "==> License heartbeat (refresh Premium after reboot)"
  if run "cd '$ROOT' && node scripts/qadbak-license-cli.mjs heartbeat"; then
    echo "    OK"
  else
    echo "    WARN — heartbeat failed — run: sudo bash scripts/repair-license-heartbeat.sh" >&2
  fi
fi

echo "==> Terminal WS backend (:$TERMINAL_PORT)"
if ss -tln 2>/dev/null | grep -q ":${TERMINAL_PORT} "; then
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${TERMINAL_PORT}/" 2>/dev/null || echo 000)"
  echo "    listening — HTTP $CODE (426 = OK)"
else
  echo "    FAIL — qadbak-terminal not listening on 127.0.0.1:$TERMINAL_PORT" >&2
  run "cd '$ROOT' && pm2 logs qadbak-terminal --lines 15 --nostream" 2>/dev/null || true
  if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/ensure-terminal-deps.sh" ]]; then
    echo "    Retry: ensure-terminal-deps + restart terminal only" >&2
    bash "$ROOT/scripts/ensure-terminal-deps.sh"
    run "cd '$ROOT' && pm2 restart qadbak-terminal"
    sleep 2
    if ss -tln 2>/dev/null | grep -q ":${TERMINAL_PORT} "; then
      echo "    OK — terminal recovered after deps reinstall"
    else
      echo "    Fix: sudo bash scripts/apply-terminal-native.sh" >&2
      exit 1
    fi
  else
    echo "    Fix: sudo bash scripts/apply-terminal-native.sh" >&2
    exit 1
  fi
fi

echo ""
echo "Done. Panel + terminal WS should be up."
echo "Check: sudo -u $USER pm2 list"
echo "Terminals: sudo bash scripts/check-terminal-ws.sh"
