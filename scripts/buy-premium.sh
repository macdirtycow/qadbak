#!/usr/bin/env bash
# One-shot upgrade-and-activate for customers who buy Premium on an
# existing Qadbak install.
#
# Open-core model: Premium source ships in this repo. Activation flips
# the gating flag on the running panel — there is no artifact to
# download, no signing pipeline, and no second activation step.
#
# Usage:
#   sudo bash /opt/qadbak/scripts/buy-premium.sh QAD-XXXX-YYYY-ZZZZ
#
# Steps, in order:
#   1. Pull latest Qadbak (carries any unreleased Core + Premium fixes)
#   2. Rebuild + restart pm2 as the qadbak user
#   3. Activate the key against license.omiiba.dev
#   4. Run repair-panel-premium (Qmail, mobile API, license sync)
#
# Idempotent: safe to re-run if any step fails.

set -euo pipefail

KEY="${1:-${QADBAK_LICENSE_KEY:-}}"
if [[ -z "$KEY" ]]; then
  cat <<EOF >&2
Usage: sudo bash $0 <LICENSE-KEY>

Example:
  sudo bash $0 QAD-1234-5678-9ABC-DEF0
EOF
  exit 2
fi

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0 <KEY>" >&2
  exit 1
fi

if [[ ! -d "$ROOT" ]]; then
  echo "Qadbak install not found at $ROOT — set QADBAK_DIR or install first." >&2
  exit 1
fi

step() { echo ""; echo "==> $*"; }

step "1/4 Pull latest Qadbak"
cd "$ROOT"
bash "$ROOT/scripts/reset-git-drift-before-pull.sh"
bash "$ROOT/scripts/git-sync-origin.sh"
bash "$ROOT/scripts/fix-qadbak-ownership.sh"

step "2/4 Rebuild and restart"
sudo -u "$USER" bash -c "cd '$ROOT' && npm install && npm run build"
sudo -u "$USER" bash "$ROOT/scripts/pm2-restart-qadbak.sh"

# Wait briefly for pm2 to reach steady state — Activate calls the
# license server and writes to data/license.json which the panel reads.
sleep 2

step "3/4 Activate license"
ACTIVATE_OUT=$(sudo -u "$USER" bash -c "cd '$ROOT' && node scripts/qadbak-license-cli.mjs activate '$KEY'" 2>&1) || {
  echo "$ACTIVATE_OUT" >&2
  echo "License activation failed. Common causes:" >&2
  echo "  - Key already activated on another VPS (remove old slot at https://license.omiiba.dev first)" >&2
  echo "  - Network: this server can't reach license.omiiba.dev" >&2
  exit 1
}
echo "$ACTIVATE_OUT"

step "4/4 Premium + mobile app setup"
if [[ -f "$ROOT/scripts/repair-panel-premium.sh" ]]; then
  bash "$ROOT/scripts/repair-panel-premium.sh" || echo "  WARN: repair-panel-premium.sh failed" >&2
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo "  Premium is now active on this server."
echo ""
echo "  Open:   https://$(hostname -f)/admin/license"
echo "  Try:    /admin/updates, /admin/clients, /admin/resellers"
echo "  iOS:    docs/MOBILE-IOS-APP.md — TestFlight via support@omiiba.dev"
echo "──────────────────────────────────────────────────────────────"
