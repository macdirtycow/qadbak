#!/usr/bin/env bash
# Audit native vs VirtualMin dependency — run on the VPS after changing .env.local.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
ENV_FILE="$ROOT/.env.local"
# shellcheck source=scripts/lib/read-env-local.sh
source "$ROOT/scripts/lib/read-env-local.sh" 2>/dev/null || true

if [[ -f "$ENV_FILE" ]]; then
  QADBAK_PROVISIONER="$(read_env_local_key QADBAK_PROVISIONER virtualmin)"
  QADBAK_NATIVE_FEATURES="$(read_env_local_key QADBAK_NATIVE_FEATURES "")"
  QADBAK_VIRTUALMIN_FALLBACK="$(read_env_local_key QADBAK_VIRTUALMIN_FALLBACK true)"
  QADBAK_DISABLE_WEBMIN="$(read_env_local_key QADBAK_DISABLE_WEBMIN false)"
  QADBAK_MAIL_BACKEND="$(read_env_local_key QADBAK_MAIL_BACKEND auto)"
fi

echo "=== Qadbak provisioner audit ==="
echo "QADBAK_PROVISIONER=${QADBAK_PROVISIONER:-virtualmin}"
echo "QADBAK_NATIVE_FEATURES=${QADBAK_NATIVE_FEATURES:-<none>}"
echo "QADBAK_VIRTUALMIN_FALLBACK=${QADBAK_VIRTUALMIN_FALLBACK:-true}"
echo "QADBAK_DISABLE_WEBMIN=${QADBAK_DISABLE_WEBMIN:-false}"
echo "QADBAK_MAIL_BACKEND=${QADBAK_MAIL_BACKEND:-auto}"
echo ""

INDEPENDENT=0
if [[ "${QADBAK_PROVISIONER:-}" == "native" ]]; then
  INDEPENDENT=1
elif [[ "${QADBAK_PROVISIONER:-}" == "hybrid" ]] && [[ "${QADBAK_VIRTUALMIN_FALLBACK:-true}" =~ ^(false|0|no)$ ]]; then
  INDEPENDENT=1
fi

NATIVE_MODULES=(
  ssl dns mail db domain backup cron aliases redirects features logs
  php ftp limits lifecycle mail-settings mail-logs imap protected shared
  proxies scripts security resellers
)

echo "Native feature flags (QADBAK_NATIVE_FEATURES — remote.cgi replaced when [x]):"
for f in "${NATIVE_MODULES[@]}"; do
  if echo "${QADBAK_NATIVE_FEATURES:-}" | tr ',' '\n' | grep -qx "$f"; then
    echo "  [x] $f"
  else
    echo "  [ ] $f"
  fi
done
echo ""

echo "Always native (no VirtualMin program):"
echo "  [x] domain list — data/native-domains.json"
echo "  [x] files — domain-fs-helper / live mode"
echo "  [x] terminal — qadbak-terminal WebSocket"
echo "  [x] website repair / stack — bash scripts"
echo "  [x] admin status / host metrics — systemctl + /proc"
echo ""

if [[ "$INDEPENDENT" -eq 1 ]]; then
  echo "Independent admin & lifecycle (provisioning-helper, no remote.cgi):"
  echo "  [x] clone-domain — domain-clone (rsync public_html + config)"
  echo "  [x] transfer-domain — panel user in data/users.json"
  echo "  [x] migrate-domain — backup tarball + manual rsync/DNS steps"
  echo "  [x] license-info — Qadbak Independent (no VM license)"
  echo "  [x] list-templates — data/native-templates.json"
  echo "  [x] list-admins / create-admin / delete-admin — data/users.json"
  echo "  [x] list-global-features / set-global-feature — data/native-admin-state.json"
  echo "  [x] check-config / config-system — nginx -t + systemctl"
  echo "  [x] list-s3-buckets / files / upload — AWS CLI (aws on PATH)"
  echo "  [x] vm-status API — native service probe (no VIRTUALMIN_URL)"
  echo ""
  echo "UI / nginx:"
  echo "  [x] Webmin tab hidden (QADBAK_DISABLE_WEBMIN or independent)"
  echo "  [x] Panel nginx templates — no /embed/webmin/ (see deploy/nginx-webmin-embed-snippet.conf)"
  echo ""
  echo "Mode: INDEPENDENT — VirtualMin API not used."
  echo "  Uninstall (after tests): sudo bash scripts/uninstall-virtualmin.sh"
  echo "  Revert API: QADBAK_PROVISIONER=hybrid + QADBAK_VIRTUALMIN_FALLBACK=true + pm2 restart"
else
  echo "Hybrid mode — disabled native flags above may still call remote.cgi."
  echo "  Enable all: sudo bash scripts/apply-phase8-native-enable.sh"
  echo "  Go independent: sudo bash scripts/apply-phase8-independent.sh"
fi
echo ""
echo "Docs: docs/PHASE-8-INDEPENDENT.md · docs/VM-REMOVAL-ROADMAP.md"
