#!/usr/bin/env bash
# Activate (or re-activate) Premium on this panel. Run as root after install.
# Usage: sudo bash scripts/activate-panel-license.sh QAD-XXXXXXXX
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
KEY="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/activate-panel-license.sh QAD-..." >&2
  exit 1
fi
if [[ -z "$KEY" ]]; then
  echo "Usage: sudo bash $0 QAD-YOUR-LICENSE-KEY" >&2
  exit 1
fi
if [[ ! -f "$ROOT/.env.local" ]]; then
  echo "Missing $ROOT/.env.local — run install first." >&2
  exit 1
fi

echo "==> Reach license server"
if ! curl -sf "${QADBAK_LICENSE_SERVER:-https://license.inveil.dev}/health" >/dev/null; then
  echo "WARN: cannot reach license server health URL" >&2
fi

echo "==> Activate"
OUT="$(sudo -u "$USER" bash -c "set -a && source '$ROOT/.env.local' && set +a && node '$ROOT/scripts/qadbak-license-cli.mjs' activate '$KEY'" 2>&1)" || true
echo "$OUT"
if ! echo "$OUT" | grep -q '"ok":true'; then
  echo "" >&2
  echo "Activation failed. If the key should work on multiple servers:" >&2
  echo "  License server dashboard → your license → Max servers (VPS) = 2 or more" >&2
  echo "  Remove stale activations (old VPS) with Remove, then run this script again." >&2
  exit 1
fi

echo "==> Heartbeat + pm2 restart"
sudo -u "$USER" bash -c "set -a && source '$ROOT/.env.local' && set +a && node '$ROOT/scripts/qadbak-license-cli.mjs' heartbeat"
bash "$ROOT/scripts/pm2-restart-qadbak.sh"
echo "OK — check Server admin → License in the panel"
