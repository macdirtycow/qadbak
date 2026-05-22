#!/usr/bin/env bash
# Which native features are on — and panel areas still blocked without them.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
[[ -f "$ROOT/.env.local" ]] && set -a && source "$ROOT/.env.local" && set +a

bash "$ROOT/scripts/audit-vm-dependency.sh"

echo ""
echo "Panel tabs — native when feature enabled:"
echo "  [x] ssl,dns,mail,db,backup,cron — core"
echo "  [ ] aliases,redirects,features,logs — enable: sudo bash scripts/apply-phase8-native-v1-panel.sh"
echo ""
echo "Still needs native module or hybrid fallback:"
echo "  php, ftp, proxies, protected, scripts, limits, lifecycle, mail-settings, …"
echo ""
echo "Before apt remove webmin: panel test + VPS snapshot"
