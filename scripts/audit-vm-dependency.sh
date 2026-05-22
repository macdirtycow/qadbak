#!/usr/bin/env bash
# Show which native features are enabled vs still needing VirtualMin.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
[[ -f "$ROOT/.env.local" ]] && source "$ROOT/.env.local"

echo "QADBAK_PROVISIONER=${QADBAK_PROVISIONER:-virtualmin}"
echo "QADBAK_NATIVE_FEATURES=${QADBAK_NATIVE_FEATURES:-<none>}"
echo "QADBAK_VIRTUALMIN_FALLBACK=${QADBAK_VIRTUALMIN_FALLBACK:-true}"
echo "QADBAK_DISABLE_WEBMIN=${QADBAK_DISABLE_WEBMIN:-false}"
echo ""
echo "Native modules (no remote.cgi when enabled):"
for f in ssl dns mail db domain backup cron; do
  if echo "${QADBAK_NATIVE_FEATURES:-}" | tr ',' '\n' | grep -qx "$f"; then
    echo "  [x] $f"
  else
    echo "  [ ] $f — still VirtualMin API if used in panel"
  fi
done
echo ""
if [[ "${QADBAK_VIRTUALMIN_FALLBACK:-true}" == "false" ]]; then
  echo "Fallback OFF — safe to remove VirtualMin packages after testing."
else
  echo "Fallback ON — panel may still call remote.cgi for disabled features."
fi
