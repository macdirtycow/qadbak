#!/usr/bin/env bash
# Which native features are on — and panel areas still blocked without them.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
[[ -f "$ROOT/.env.local" ]] && set -a && source "$ROOT/.env.local" && set +a

bash "$ROOT/scripts/audit-vm-dependency.sh"

echo ""
echo "Enabled native features in .env:"
if [[ -n "${QADBAK_NATIVE_FEATURES:-}" ]]; then
  echo "$QADBAK_NATIVE_FEATURES" | tr ',' '\n' | sed 's/^/  - /'
else
  echo "  (none)"
fi

echo ""
echo "Panel tabs (v1) — native when flag enabled above:"
for f in ssl dns mail db backup cron aliases redirects features logs; do
  if echo ",${QADBAK_NATIVE_FEATURES:-}," | grep -q ",$f,"; then
    echo "  [x] $f"
  else
    echo "  [ ] $f"
  fi
done

echo ""
echo "Still needs hybrid fallback or future native module:"
echo "  php, ftp, proxies, protected, scripts, limits, lifecycle, mail-settings, domain-create, …"

if [[ "${QADBAK_PROVISIONER:-}" == "native" && "${QADBAK_VIRTUALMIN_FALLBACK:-}" == "false" ]]; then
  echo ""
  echo "Mode: INDEPENDENT — no remote.cgi."
else
  echo ""
  echo "Tip: terug naar onafhankelijk:"
  echo "  sudo bash scripts/apply-phase8-independent.sh"
fi
