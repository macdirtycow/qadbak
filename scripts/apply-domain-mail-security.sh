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
  dkim="$(jq -r '.dkimEnabled // true' "$CFG" 2>/dev/null)"
else
  dkim=1
fi

if [[ "$dkim" == "true" ]] && command -v opendkim-genkey &>/dev/null; then
  KEYDIR="/etc/opendkim/keys/${DOMAIN}"
  SELECTOR="mail"
  mkdir -p "$KEYDIR"
  if [[ ! -f "$KEYDIR/${SELECTOR}.private" ]]; then
    opendkim-genkey -b 2048 -d "$DOMAIN" -D "$KEYDIR" -s "$SELECTOR" -v
    chown -R opendkim:opendkim "$KEYDIR" 2>/dev/null || true
  fi
  KEYTABLE="/etc/opendkim/KeyTable"
  SIGNING="/etc/opendkim/SigningTable"
  TRUSTED="/etc/opendkim/TrustedHosts"
  mkdir -p /etc/opendkim
  touch "$KEYTABLE" "$SIGNING" "$TRUSTED"
  KEY_LINE="${SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${SELECTOR}:${KEYDIR}/${SELECTOR}.private"
  SIGN_LINE="*@${DOMAIN} ${SELECTOR}._domainkey.${DOMAIN}"
  grep -qF "$KEY_LINE" "$KEYTABLE" 2>/dev/null || echo "$KEY_LINE" >>"$KEYTABLE"
  grep -qF "@${DOMAIN}" "$SIGNING" 2>/dev/null || echo "$SIGN_LINE" >>"$SIGNING"
  grep -qF "$DOMAIN" "$TRUSTED" 2>/dev/null || echo "*.${DOMAIN}" >>"$TRUSTED"
  if [[ -x "$QADBAK_DIR/scripts/configure-opendkim-native.sh" ]]; then
    bash "$QADBAK_DIR/scripts/configure-opendkim-native.sh"
  else
    systemctl reload opendkim 2>/dev/null || true
  fi
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
