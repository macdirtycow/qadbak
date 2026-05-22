#!/usr/bin/env bash
# Build data/native-domains.json from VirtualMin (one-time / after new domain in VM).
# Used when moving to QADBAK_PROVISIONER=hybrid|native on an existing server.
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
OUT="$ROOT/data/native-domains.json"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/export-native-domains.sh" >&2
  exit 1
fi

mkdir -p "$ROOT/data"

if ! command -v virtualmin &>/dev/null; then
  echo "virtualmin CLI not found — create $OUT manually or from /home/*/.qadbak-domain" >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "==> Export domains → $OUT"
{
  echo "["
  first=1
  while read -r domain; do
    [[ -z "$domain" ]] && continue
    user="$(virtualmin list-domains --domain "$domain" --multiline 2>/dev/null \
      | awk -F': *' '/^Unix username:/ {print $2; exit}')"
    user="${user:-${domain%%.*}}"
    disabled="false"
    if virtualmin list-domains --domain "$domain" --multiline 2>/dev/null | grep -qi 'Disabled.*Yes'; then
      disabled="true"
    fi
    [[ "$first" -eq 1 ]] || echo ","
    first=0
    zone_file=""
    if [[ -f "/var/lib/bind/${domain}.host" ]]; then
      zone_file="/var/lib/bind/${domain}.host"
    elif [[ -f "/var/lib/bind/${domain}" ]]; then
      zone_file="/var/lib/bind/${domain}"
    fi
    if [[ -n "$zone_file" ]]; then
      printf '  {"name":"%s","user":"%s","disabled":%s,"plan":"Default","zoneFile":"%s"}' \
        "$domain" "$user" "$disabled" "$zone_file"
    else
      printf '  {"name":"%s","user":"%s","disabled":%s,"plan":"Default"}' \
        "$domain" "$user" "$disabled"
    fi
    # Hint file for scanHomeDomains fallback
    if [[ -n "$user" && -d "/home/$user" ]]; then
      echo "$domain" >"/home/$user/.qadbak-domain"
      chown "$user:$user" "/home/$user/.qadbak-domain" 2>/dev/null || true
    fi
  done < <(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d' | grep -E '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
  echo ""
  echo "]"
} >"$TMP"

mv "$TMP" "$OUT"
chown "$QADBAK_USER:$QADBAK_USER" "$OUT"
chmod 644 "$OUT"
count="$(grep -c '"name"' "$OUT" || true)"
echo "OK — $count domain(s) in $OUT"
