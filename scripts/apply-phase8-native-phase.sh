#!/usr/bin/env bash
# Enable one or more native feature flags: sudo bash scripts/apply-phase8-native-phase.sh ssl,dns
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
FEATURES="${1:?features comma-separated, e.g. ssl,dns,mail}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

cd "$QADBAK_DIR"
git pull --ff-only 2>/dev/null || true
bash "$QADBAK_DIR/scripts/fix-qadbak-ownership.sh"

set_env() {
  local k="$1" v="$2"
  grep -q "^${k}=" "$QADBAK_DIR/.env.local" 2>/dev/null && \
    sed -i "s|^${k}=.*|${k}=${v}|" "$QADBAK_DIR/.env.local" || \
    echo "${k}=${v}" >>"$QADBAK_DIR/.env.local"
}

set_env QADBAK_PROVISIONER hybrid
set_env QADBAK_DISABLE_WEBMIN true
set_env QADBAK_VIRTUALMIN_FALLBACK true
set_env QADBAK_NATIVE_FEATURES "$FEATURES"

bash "$QADBAK_DIR/scripts/configure-provisioning-helper-sudo.sh"
bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true

sudo -u qadbak bash -c "cd '$QADBAK_DIR' && npm run build"
sudo -u qadbak bash -c "cd '$QADBAK_DIR' && bash scripts/pm2-restart-qadbak.sh"

echo "==> Test enabled features"
QADBAK_NATIVE_FEATURES="$FEATURES" bash "$QADBAK_DIR/scripts/test-native-provisioning.sh"

echo "OK — native features: $FEATURES"
