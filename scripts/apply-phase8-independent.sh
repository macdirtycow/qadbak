#!/usr/bin/env bash
# Phase 8 ONAFHANKELIJK: QADBAK_PROVISIONER=native, no VirtualMin API fallback.
#
# Usage:
#   sudo bash scripts/apply-phase8-independent.sh
#   sudo bash scripts/apply-phase8-independent.sh ssl,dns,mail,db,backup,cron,aliases,redirects,features,logs
#
# Revert: QADBAK_PROVISIONER=hybrid + QADBAK_VIRTUALMIN_FALLBACK=true + pm2 restart
set -euo pipefail
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

FEATURES="${1:-ssl,dns,mail,db,backup,cron,aliases,redirects,features,logs}"

echo "==> Phase 8 INDEPENDENT (geen VirtualMin API fallback)"
bash "$QADBAK_DIR/scripts/apply-phase8-native-phase.sh" "$FEATURES" independent

echo "==> Independent preflight"
bash "$QADBAK_DIR/scripts/preflight-phase8-independent.sh"

HEALTH="$(curl -sf "http://127.0.0.1:3000/api/health" 2>/dev/null || echo '{}')"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"

echo ""
echo "OK — Phase 8 INDEPENDENT"
echo "  provisioner=native, virtualminFallback=false"
echo "  PHP/FTP/… tabs zonder native module geven een duidelijke fout"
echo "  apt remove webmin: pas na panel-tests + snapshot"
