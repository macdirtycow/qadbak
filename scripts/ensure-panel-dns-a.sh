#!/usr/bin/env bash
# Ensure panel.<domain> A record exists in the domain's BIND zone (native DNS).
set -euo pipefail

DOMAIN="${1:?domain (e.g. example.com)}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
PANEL_LABEL="panel"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 $DOMAIN" >&2
  exit 1
}

DOMAIN="$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
ZONE_FILE=""

if [[ -f "$QADBAK_DIR/data/native-domains.json" ]]; then
  ZONE_FILE="$(node -e "
    const rows = JSON.parse(require('fs').readFileSync('$QADBAK_DIR/data/native-domains.json','utf8'));
    const hit = rows.find(r => String(r.name).toLowerCase() === '$DOMAIN');
    if (hit?.zoneFile) process.stdout.write(hit.zoneFile);
  " 2>/dev/null || true)"
fi

if [[ -z "$ZONE_FILE" || ! -f "$ZONE_FILE" ]]; then
  for p in \
    "/var/lib/bind/${DOMAIN}.hosts" \
    "/etc/bind/${DOMAIN}.zone"; do
    if [[ -f "$p" ]]; then
      ZONE_FILE="$p"
      break
    fi
  done
fi

if [[ -z "$ZONE_FILE" || ! -f "$ZONE_FILE" ]]; then
  echo "WARN: no BIND zone for $DOMAIN — add DNS manually:" >&2
  echo "  ${PANEL_LABEL}.${DOMAIN}  A  <server-ip>" >&2
  exit 0
fi

ORIGIN_IP=""
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^QADBAK_ORIGIN_IP=' "$QADBAK_DIR/.env.local" | sed 's/^/export /') || true
fi
ORIGIN_IP="${QADBAK_ORIGIN_IP:-$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"

if grep -qE "^${PANEL_LABEL}[[:space:]]" "$ZONE_FILE"; then
  echo "OK — ${PANEL_LABEL}.${DOMAIN} already in zone ($ZONE_FILE)"
  exit 0
fi

cp -a "$ZONE_FILE" "${ZONE_FILE}.bak.$(date +%Y%m%d%H%M%S)"
echo "${PANEL_LABEL} IN A ${ORIGIN_IP}" >>"$ZONE_FILE"

if grep -qE '^[[:space:]]*[0-9]{10}[[:space:]]*; serial' "$ZONE_FILE"; then
  OLD_SERIAL="$(grep -oE '[0-9]{10}' "$ZONE_FILE" | head -1)"
  NEW_SERIAL="$(date +%Y%m%d01)"
  if [[ "$NEW_SERIAL" -le "$OLD_SERIAL" ]]; then
    NEW_SERIAL="$((OLD_SERIAL + 1))"
  fi
  sed -i "0,/${OLD_SERIAL}/{s/${OLD_SERIAL}/${NEW_SERIAL}/}" "$ZONE_FILE"
fi

if command -v named-checkzone &>/dev/null; then
  named-checkzone "$DOMAIN" "$ZONE_FILE"
fi
rndc reload 2>/dev/null || systemctl reload named 2>/dev/null || systemctl reload bind9 2>/dev/null || true
echo "OK — added ${PANEL_LABEL}.${DOMAIN} → ${ORIGIN_IP} in $ZONE_FILE"
