#!/usr/bin/env bash
# Create a BIND master zone for a Qadbak native domain (fresh install / no VirtualMin).
# Idempotent — skips if zone already exists.
#
# Usage:
#   sudo bash scripts/create-bind-zone.sh example.com
set -euo pipefail

DOMAIN="${1:?domain (e.g. mareades.com)}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
ZONE_FILE="/var/lib/bind/${DOMAIN}.hosts"
LOCAL="/etc/bind/named.conf.local"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 $DOMAIN" >&2
  exit 1
}

if [[ "$DOMAIN" == *"/"* ]] || [[ "$DOMAIN" == *" "* ]]; then
  echo "Invalid domain: $DOMAIN" >&2
  exit 1
fi

if bash "$QADBAK_DIR/scripts/discover-bind-zone.sh" "$DOMAIN" 2>/dev/null; then
  echo "Zone already present for $DOMAIN"
  exit 0
fi

ORIGIN_IP=""
MAIL_HOST=""
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(QADBAK_ORIGIN_IP|QADBAK_MAIL_HOST)=' "$QADBAK_DIR/.env.local" | sed 's/^/export /') || true
fi
ORIGIN_IP="${QADBAK_ORIGIN_IP:-$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"
# Per-domain mail host in zone (not panel mail host unless same domain)
if [[ -n "${QADBAK_MAIL_HOST:-}" ]] && [[ "$QADBAK_MAIL_HOST" == *".${DOMAIN}" || "$QADBAK_MAIL_HOST" == "$DOMAIN" ]]; then
  MAIL_HOST="$QADBAK_MAIL_HOST"
else
  MAIL_HOST="mail.${DOMAIN}"
fi
MAIL_LABEL="${MAIL_HOST%%.*}"

SERIAL="$(date +%Y%m%d01)"
NS="ns1.${DOMAIN}"

mkdir -p /var/lib/bind
cat >"$ZONE_FILE" <<EOF
\$TTL 3600
@   IN  SOA ${NS}. admin.${DOMAIN}. (
            ${SERIAL} ; serial
            3600       ; refresh
            900        ; retry
            604800     ; expire
            86400 )    ; minimum
    IN  NS  ${NS}.
    IN  A   ${ORIGIN_IP}
    IN  MX  10 ${MAIL_HOST}.
ns1 IN  A   ${ORIGIN_IP}
www IN  A   ${ORIGIN_IP}
panel IN  A   ${ORIGIN_IP}
${MAIL_LABEL} IN  A   ${ORIGIN_IP}
EOF

chown root:bind "$ZONE_FILE" 2>/dev/null || chown root:named "$ZONE_FILE" 2>/dev/null || chown root:root "$ZONE_FILE"
chmod 644 "$ZONE_FILE"

touch "$LOCAL"
if ! grep -q "zone \"${DOMAIN}\"" "$LOCAL" 2>/dev/null; then
  cat >>"$LOCAL" <<EOF

zone "${DOMAIN}" {
    type master;
    file "${ZONE_FILE}";
};
EOF
fi

if command -v named-checkzone &>/dev/null; then
  named-checkzone "$DOMAIN" "$ZONE_FILE"
fi

rndc reload 2>/dev/null || systemctl reload named 2>/dev/null || systemctl reload bind9 2>/dev/null || true

bash "$QADBAK_DIR/scripts/discover-bind-zone.sh" "$DOMAIN"
echo "OK — BIND zone created for $DOMAIN"
echo "  Edit records in panel DNS tab or: $ZONE_FILE"
