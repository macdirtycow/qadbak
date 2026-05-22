#!/usr/bin/env bash
# Find BIND zone file for a domain (VirtualMin / Debian). Updates native-domains.json zoneFile.
set -euo pipefail
DOMAIN="${1:?domain}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
REG="$QADBAK_DIR/data/native-domains.json"

echo "==> Discover BIND zone for $DOMAIN"

ZONE=""
for p in \
  "/var/lib/bind/${DOMAIN}.host" \
  "/var/lib/bind/${DOMAIN}" \
  "/etc/bind/${DOMAIN}.zone" \
  "/etc/bind/zones/${DOMAIN}"; do
  if [[ -f "$p" ]]; then
    ZONE="$p"
    break
  fi
done

if [[ -z "$ZONE" ]] && command -v virtualmin &>/dev/null; then
  ZONE="$(virtualmin list-domains --domain "$DOMAIN" --multiline 2>/dev/null \
    | awk -F': *' '/^(DNS zone file|Zone file|Master file):/ {print $2; exit}')"
fi

if [[ -z "$ZONE" ]]; then
  ZONE="$(find /var/lib/bind /etc/bind -maxdepth 4 -type f \
    \( -name "${DOMAIN}.host" -o -name "${DOMAIN}.zone" -o -name "${DOMAIN}" \) 2>/dev/null | head -1)"
fi

if [[ -z "$ZONE" || ! -f "$ZONE" ]]; then
  echo "FAIL: no zone file found for $DOMAIN" >&2
  echo "  Check: named -v, virtualmin list-domains --domain $DOMAIN --multiline" >&2
  exit 1
fi

echo "OK — zone file: $ZONE"

if [[ -f "$REG" ]] && command -v jq &>/dev/null; then
  tmp="$(mktemp)"
  jq --arg d "$DOMAIN" --arg z "$ZONE" \
    'map(if .name == $d then . + {zoneFile: $z} else . end)' "$REG" >"$tmp"
  mv "$tmp" "$REG"
  echo "    Updated $REG"
elif [[ -f "$REG" ]]; then
  echo "    (install jq to auto-update $REG, or add zoneFile manually)"
fi

echo "Test:"
sudo -u qadbak sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" dns-get "$DOMAIN" | tail -1
