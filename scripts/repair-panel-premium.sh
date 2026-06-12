#!/usr/bin/env bash
# Diagnose and repair Premium + mail on this panel VPS.
# Usage:
#   sudo bash scripts/repair-panel-premium.sh
#   sudo bash scripts/repair-panel-premium.sh omiiba.dev
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
DOMAIN="${1:-}"
ENV_FILE="$ROOT/.env.local"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/repair-panel-premium.sh [domain]" >&2
  exit 1
}

echo "==> License server reachability"
curl -sf "${QADBAK_LICENSE_SERVER:-https://license.omiiba.dev}/health" && echo " OK" || {
  echo "WARN: cannot reach license server" >&2
}

echo ""
echo "==> .env.local (license + native features)"
grep -E '^(QADBAK_LICENSE_SERVER|QADBAK_LICENSE_JWT_SECRET|QADBAK_PREMIUM_FEATURES|QADBAK_NATIVE_FEATURES)=' \
  "$ENV_FILE" 2>/dev/null || echo "  (missing keys)"

if [[ -f "$ROOT/data/license.json" ]]; then
  echo ""
  echo "==> data/license.json features"
  node -e "
    const fs=require('fs');
    const p=process.argv[1];
    const j=JSON.parse(fs.readFileSync(p,'utf8'));
    console.log('  status:', j.status);
    console.log('  plan:', j.plan);
    console.log('  features:', (j.features||[]).join(', ') || '(none)');
    console.log('  lastHeartbeat:', j.lastHeartbeatAt || '—');
    const need=['white-label','client-rbac','admin-updates'];
    for (const f of need) {
      if (!(j.features||[]).includes(f)) console.log('  MISSING feature:', f);
    }
  " "$ROOT/data/license.json"
else
  echo "  No license.json — activate a key first."
fi

echo ""
echo "==> Install fingerprint (license compliance — required on every server)"
bash "$ROOT/scripts/ensure-install-salt.sh" || {
  echo "  FAIL — could not set QADBAK_INSTALL_SALT" >&2
  exit 1
}

echo ""
echo "==> Heartbeat (refresh features + fingerprint from license server)"
sudo -u "$USER" bash -c "set -a && source '$ENV_FILE' && set +a && node '$ROOT/scripts/qadbak-license-cli.mjs' heartbeat" || {
  echo "WARN: heartbeat failed — check JWT secret matches license server" >&2
}

if [[ -f "$ROOT/scripts/configure-license-heartbeat-timer.sh" ]]; then
  echo ""
  echo "==> Systemd license heartbeat timer (every 6h fallback)"
  bash "$ROOT/scripts/configure-license-heartbeat-timer.sh" || true
fi

echo ""
echo "==> Restart panel (load QADBAK_PREMIUM_FEATURES from .env.local)"
bash "$ROOT/scripts/pm2-restart-qadbak.sh"

if [[ -f "$ROOT/data/license.json" ]]; then
  echo ""
  echo "==> After heartbeat"
  node -e "
    const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
    console.log('  features:', (j.features||[]).join(', '));
  " "$ROOT/data/license.json"
fi

echo ""
echo "==> Native mail / webmail (imap in QADBAK_NATIVE_FEATURES)"
if grep -q '^QADBAK_NATIVE_FEATURES=' "$ENV_FILE" 2>/dev/null; then
  if grep '^QADBAK_NATIVE_FEATURES=' "$ENV_FILE" | grep -qE '(^|,)(imap)(,|$)'; then
    echo "  imap: present"
  else
    echo "  imap: MISSING — adding to QADBAK_NATIVE_FEATURES"
    sed -i.bak -E 's/^(QADBAK_NATIVE_FEATURES=.*)$/\1,imap/' "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    bash "$ROOT/scripts/pm2-restart-qadbak.sh"
  fi
else
  echo "  WARN: no QADBAK_NATIVE_FEATURES in .env.local" >&2
fi

if [[ -n "$DOMAIN" && -f "$ROOT/scripts/repair-panel-webmail.sh" ]]; then
  echo ""
  echo "==> Webmail repair for $DOMAIN"
  bash "$ROOT/scripts/repair-panel-webmail.sh" "$DOMAIN" info || true
fi

echo ""
echo "Done."
echo "  License admin: ensure white-label is checked → Save → Heartbeat here"
echo "  Or on license VPS: node /opt/qadbak-premium/ops/backfill-license-features.mjs"
echo "  Panel: Server admin → License (features list) → Branding / Updates"
