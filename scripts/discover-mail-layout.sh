#!/usr/bin/env bash
# Show Postfix/Dovecot mail layout for a domain (debug direct mail).
set -euo pipefail
DOMAIN="${1:?domain}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"

if ! grep -q 'load-env-local' "$QADBAK_DIR/scripts/provisioning-helper.mjs" 2>/dev/null; then
  echo "WARN: git pull needed (old provisioning-helper). Run: sudo bash scripts/pull-and-helpers.sh" >&2
fi

echo "==> .env mail settings"
grep -E '^QADBAK_(MAIL|PROVISIONER|VIRTUALMIN)' "$QADBAK_DIR/.env.local" 2>/dev/null || true

echo ""
echo "==> mail-list (expect source: postfix-dovecot)"
sudo -u qadbak sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-list "$DOMAIN" | tail -1

OWNER="$(grep -o '"user":"[^"]*"' "$QADBAK_DIR/data/native-domains.json" | head -1 | sed 's/"user":"//;s/"//')"
if [[ -n "$OWNER" ]]; then
  echo ""
  echo "==> home / Maildir"
  ls -la "/home/$OWNER/Maildir" 2>/dev/null | head -5 || echo "    no /home/$OWNER/Maildir"
  ls -la "/home/$OWNER/homes" 2>/dev/null | head -5 || echo "    no /home/$OWNER/homes"
fi

echo ""
echo "==> postconf"
postconf -n virtual_alias_maps virtual_mailbox_maps virtual_mailbox_base 2>/dev/null || true

REG="$QADBAK_DIR/data/native-domains.json"
if [[ -f "$REG" ]]; then
  echo ""
  echo "==> native-domains row"
  grep -A6 "\"name\":\"$DOMAIN\"" "$REG" | head -8 || true
fi
