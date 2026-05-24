#!/usr/bin/env bash
# Build Premium bundle on the VPS and install into the local license server.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
PREMIUM_DIR="${QADBAK_PREMIUM_DIR:-/opt/qadbak-premium}"
ENV_FILE="${QADBAK_LICENSE_ENV:-/etc/qadbak/license-server.env}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

[[ -d "$PREMIUM_DIR" ]] || {
  echo "Missing $PREMIUM_DIR — clone qadbak-premium first." >&2
  exit 1
}

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
  export LICENSE_SERVER="${LICENSE_SERVER:-http://127.0.0.1:${LICENSE_PORT:-8787}}"
  export LICENSE_ARTIFACTS_DIR="${LICENSE_ARTIFACTS_DIR:-$PREMIUM_DIR/license-server/data/artifacts}"
fi

echo "==> Update qadbak-premium"
git -C "$PREMIUM_DIR" pull --ff-only origin main 2>/dev/null || true

echo "==> build:release"
cd "$PREMIUM_DIR"
npm install --no-audit --no-fund
npm run build:release

VER="$(node -p "require('$PREMIUM_DIR/package.json').version")"
ART="$PREMIUM_DIR/license-server/data/artifacts/$VER/premium.tar.gz"
if [[ ! -f "$ART" ]]; then
  echo "FAIL: artifact not found at $ART" >&2
  exit 1
fi
echo "OK — artifact $ART ($(du -h "$ART" | awk '{print $1}'))"

echo "==> Sync to panel"
sudo -u qadbak bash -c "
  set -a
  source '$QADBAK_DIR/.env.local'
  export QADBAK_SKIP_SIGNATURE_VERIFY=true
  set +a
  cd '$QADBAK_DIR'
  node scripts/sync-premium-artifact.mjs
"
bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"
echo "Done — open Server admin → Updates"
