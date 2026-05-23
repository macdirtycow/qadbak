#!/usr/bin/env bash
# Quick diagnostics for native Qadbak terminal WebSocket.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${QADBAK_TERMINAL_WS_PORT:-3001}"
PANEL_PORT="${QADBAK_PANEL_PORT:-11000}"
USER="${QADBAK_USER:-qadbak}"

echo "==> node-pty module"
if sudo -u "$USER" bash -c "cd '$ROOT' && node -e \"require('node-pty'); console.log('ok')\"" 2>/dev/null; then
  echo "    OK"
else
  echo "    FAIL — run: sudo bash scripts/install-node-build-deps.sh" >&2
  echo "           sudo -u $USER bash -c 'cd $ROOT && npm install'" >&2
fi

echo "==> pm2 qadbak-terminal"
if command -v pm2 &>/dev/null; then
  sudo -u "$USER" pm2 describe qadbak-terminal 2>/dev/null | grep -E 'status|restarts|error' || echo "    not in pm2 (start: pm2 start ecosystem.config.cjs)"
else
  echo "    pm2 not found"
fi

echo "==> TCP $PORT (terminal WS backend)"
if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "    listening on 127.0.0.1:$PORT"
else
  echo "    NOT listening — qadbak-terminal down?" >&2
fi

echo "==> nginx /ws/domain-terminal on :$PANEL_PORT"
CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:${PANEL_PORT}/ws/domain-terminal" 2>/dev/null || echo 000)"
echo "    HTTP $CODE (426 Upgrade Required = OK)"

echo "==> nginx /ws/admin-terminal on :$PANEL_PORT"
ACODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:${PANEL_PORT}/ws/admin-terminal" 2>/dev/null || echo 000)"
echo "    HTTP $ACODE (426 Upgrade Required = OK)"

echo "==> sudo admin terminal"
if sudo -u "$USER" sudo -n -l 2>/dev/null | grep -q "run-admin-terminal.sh"; then
  echo "    OK (run-admin-terminal.sh)"
else
  echo "    FAIL — run: sudo bash scripts/configure-admin-terminal-sudo.sh" >&2
fi

echo "==> sudo domain terminal runner"
if sudo -u "$USER" sudo -n -l 2>/dev/null | grep -q "run-domain-terminal.sh"; then
  TEST_USER=""
  if [[ -f "$ROOT/data/native-domains.json" ]]; then
    TEST_USER="$(python3 -c "
import json
from pathlib import Path
p = Path('$ROOT/data/native-domains.json')
if p.exists():
    d = json.loads(p.read_text())
    for row in d if isinstance(d, list) else d.get('domains', []):
        u = row.get('user') or row.get('unixUser')
        if u:
            print(u)
            break
" 2>/dev/null || true)"
  fi
  if [[ -z "$TEST_USER" ]]; then
    TEST_USER="$(getent passwd | awk -F: '$6 ~ /^\/home\/[^/]+$/ && $1 != "qadbak" {print $1; exit}')"
  fi
  if [[ -n "$TEST_USER" ]]; then
    echo "    OK (sudo rule; domain user: $TEST_USER)"
  else
    echo "    OK (sudo rule present)"
  fi
else
  echo "    FAIL — run: sudo bash scripts/configure-domain-terminal-sudo.sh" >&2
fi
