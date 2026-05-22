#!/usr/bin/env bash
# Enable one or more native feature flags: sudo bash scripts/apply-phase8-native-phase.sh ssl,dns
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
FEATURES="${1:?features comma-separated, e.g. ssl,dns,mail}"
# Second arg "independent" → native provisioner, no VirtualMin API fallback (default: hybrid + fallback).
MODE="${2:-hybrid}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

cd "$QADBAK_DIR"
echo "==> git pull"
bash "$QADBAK_DIR/scripts/reset-git-drift-before-pull.sh"
git pull --ff-only
bash "$QADBAK_DIR/scripts/fix-qadbak-ownership.sh"

set_env() {
  local k="$1" v="$2"
  grep -q "^${k}=" "$QADBAK_DIR/.env.local" 2>/dev/null && \
    sed -i "s|^${k}=.*|${k}=${v}|" "$QADBAK_DIR/.env.local" || \
    echo "${k}=${v}" >>"$QADBAK_DIR/.env.local"
}

set_env QADBAK_DISABLE_WEBMIN true
set_env QADBAK_NATIVE_FEATURES "$FEATURES"
if [[ "$MODE" == "independent" ]]; then
  echo "==> Mode: INDEPENDENT (no remote.cgi)"
  set_env QADBAK_PROVISIONER native
  set_env QADBAK_VIRTUALMIN_FALLBACK false
  set_env QADBAK_MAIL_BACKEND direct
  set_env QADBAK_INDEPENDENCE_PHASE 8-independent
else
  echo "==> Mode: HYBRID (VirtualMin API fallback for non-native tabs)"
  set_env QADBAK_PROVISIONER hybrid
  set_env QADBAK_VIRTUALMIN_FALLBACK true
fi

bash "$QADBAK_DIR/scripts/configure-provisioning-helper-sudo.sh"
bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true

if echo ",$FEATURES," | grep -q ',dns,'; then
  echo "==> Discover BIND zone files"
  bash "$QADBAK_DIR/scripts/discover-all-bind-zones.sh" || true
fi

sudo -u qadbak bash -c "cd '$QADBAK_DIR' && npm run build"
sudo -u qadbak bash -c "cd '$QADBAK_DIR' && bash scripts/pm2-restart-qadbak.sh"

echo "==> Test enabled features"
QADBAK_NATIVE_FEATURES="$FEATURES" bash "$QADBAK_DIR/scripts/test-native-provisioning.sh"

echo "OK — native features: $FEATURES (mode=$MODE)"
