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

FEATURES="${1:-ssl,dns,mail,db,domain,backup,cron,aliases,redirects,features,logs,php,ftp,limits,lifecycle,mail-settings,mail-logs,imap,protected,shared,proxies,scripts,security,resellers}"

echo "==> Phase 8 INDEPENDENT (no VirtualMin API fallback)"
bash "$QADBAK_DIR/scripts/apply-phase8-native-phase.sh" "$FEATURES" independent

echo "==> Panel nginx + terminals"
bash "$QADBAK_DIR/scripts/fix-panel-nginx-port.sh"
bash "$QADBAK_DIR/scripts/apply-terminal-native.sh"

echo "==> Independent preflight"
bash "$QADBAK_DIR/scripts/preflight-phase8-independent.sh"

HEALTH="$(curl -sf "http://127.0.0.1:3000/api/health" 2>/dev/null || echo '{}')"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"

echo ""
echo "OK — Phase 8 INDEPENDENT"
echo "  provisioner=native, virtualminFallback=false"
echo "  native: ssl,dns,mail,db,domain,backup,cron,aliases,redirects,features,logs,php,ftp,limits,lifecycle,mail-settings,mail-logs,imap,protected,shared,proxies,scripts,security,resellers"
echo "  Webmin embeds off (QADBAK_DISABLE_WEBMIN=true)"
echo "  apt remove webmin: only after panel tests + snapshot"
