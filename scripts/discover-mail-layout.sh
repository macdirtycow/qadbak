#!/usr/bin/env bash
# Show Postfix/Dovecot mail layout for a domain (debug direct mail).
set -euo pipefail
DOMAIN="${1:?domain}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"

echo "==> Mail layout for $DOMAIN"
sudo -u qadbak sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-list "$DOMAIN" | tail -1

echo ""
echo "==> postconf"
postconf -n virtual_alias_maps virtual_mailbox_maps virtual_mailbox_base 2>/dev/null || true

REG="$QADBAK_DIR/data/native-domains.json"
if [[ -f "$REG" ]]; then
  echo ""
  echo "==> native-domains row"
  grep -A6 "\"name\":\"$DOMAIN\"" "$REG" | head -8 || true
fi
