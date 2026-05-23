#!/usr/bin/env bash
# Apply per-domain spam/DKIM settings from data/domain-config/DOMAIN/security.json
set -euo pipefail
DOMAIN="${1:?domain}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
CFG="$QADBAK_DIR/data/domain-config/${DOMAIN}/security.json"

spam=0
dkim=0
if [[ -f "$CFG" ]] && command -v jq &>/dev/null; then
  spam="$(jq -r '.spamEnabled // false' "$CFG" 2>/dev/null)"
  dkim="$(jq -r '.dkimEnabled // false' "$CFG" 2>/dev/null)"
fi

if [[ "$dkim" == "true" ]] && command -v opendkim-genkey &>/dev/null; then
  KEYDIR="/etc/opendkim/keys/${DOMAIN}"
  mkdir -p "$KEYDIR"
  if [[ ! -f "$KEYDIR/mail.private" ]]; then
    opendkim-genkey -b 2048 -d "$DOMAIN" -D "$KEYDIR" -s mail -v
    chown -R opendkim:opendkim "$KEYDIR" 2>/dev/null || true
  fi
  if [[ -f /etc/opendkim/signing.table ]]; then
    LINE="mail._domainkey.${DOMAIN} ${DOMAIN}:mail:${KEYDIR}/mail.private"
    grep -qF "$DOMAIN" /etc/opendkim/signing.table 2>/dev/null || echo "$LINE" >>/etc/opendkim/signing.table
  fi
  if [[ -f /etc/opendkim/key.table ]]; then
    grep -qF "${DOMAIN}:mail:" /etc/opendkim/key.table 2>/dev/null || \
      echo "mail._domainkey.${DOMAIN} ${DOMAIN}:mail:${KEYDIR}/mail.private" >>/etc/opendkim/key.table
  fi
  systemctl reload opendkim 2>/dev/null || true
fi

if [[ "$spam" == "true" ]]; then
  if systemctl list-unit-files spamassassin.service &>/dev/null; then
    systemctl enable --now spamassassin 2>/dev/null || true
  fi
  if [[ -f /etc/postfix/main.cf ]] && ! grep -q 'spamassassin' /etc/postfix/main.cf 2>/dev/null; then
    postconf -e 'content_filter=spamassassin' 2>/dev/null || true
  fi
  systemctl reload postfix 2>/dev/null || true
fi

echo "OK — mail security applied for ${DOMAIN}"
