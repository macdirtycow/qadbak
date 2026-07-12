#!/usr/bin/env bash
# Restore Qadbak mail + webmail after Inveil rebrand.
#
# - Mailboxes live on @omiiba.dev (or MAIL_DOMAIN)
# - @inveil.net addresses forward to @omiiba.dev
# - Postfix/Dovecot + panel webmail (Qmail)
# - Prints Cloudflare DNS records (MX, SPF, DKIM, DMARC)
#
# Run on the MAIN VPS (where Qadbak panel + mail live), as root:
#   cd /opt/qadbak && git pull
#   sudo bash scripts/restore-inveil-mail.sh
#
# Options (env):
#   MAIL_DOMAIN=omiiba.dev      primary mailboxes
#   FORWARD_DOMAIN=inveil.net   forward-only domain
#   MAIL_HOST=mail.inveil.net   MX/IMAP hostname (default: mail.${FORWARD_DOMAIN})
#   MAILBOXES="info,support,..." comma-separated local parts to forward
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
ENV_FILE="$QADBAK_DIR/.env.local"
MAIL_DOMAIN="${MAIL_DOMAIN:-omiiba.dev}"
FORWARD_DOMAIN="${FORWARD_DOMAIN:-inveil.net}"
MAIL_HOST="${MAIL_HOST:-mail.${FORWARD_DOMAIN}}"
MAILBOXES="${MAILBOXES:-info,support,legal,privacy,billing,security,license,dmarc}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/restore-inveil-mail.sh" >&2
  exit 1
}

[[ -d "$QADBAK_DIR" ]] || {
  echo "Missing $QADBAK_DIR" >&2
  exit 1
}

log() { echo "==> $*"; }

upsert_env() {
  local key="$1" val="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

log "Mail layout: *@${FORWARD_DOMAIN} → *@${MAIL_DOMAIN} (mailboxes on .dev)"
log "Mail hostname (MX/IMAP): ${MAIL_HOST}"

if [[ -f "$QADBAK_DIR/scripts/export-native-domains.sh" ]]; then
  log "Refresh domain registry from /home/*"
  bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true
fi

log "Register forwards in panel data"
export MAIL_DOMAIN FORWARD_DOMAIN MAILBOXES QADBAK_DIR
node "$QADBAK_DIR/scripts/lib/setup-inveil-mail-forwards.mjs"

log "Panel env (.env.local)"
upsert_env QADBAK_MAIL_BACKEND direct
upsert_env QADBAK_MAIL_HOST "$MAIL_HOST"
upsert_env QADBAK_MAIL_AUTODNS false
if [[ -f "$ENV_FILE" ]] && grep -q '^QADBAK_ORIGIN_IP=' "$ENV_FILE" 2>/dev/null; then
  :
else
  ORIGIN_IP="$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)"
  [[ -n "$ORIGIN_IP" ]] && upsert_env QADBAK_ORIGIN_IP "$ORIGIN_IP"
fi
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE" 2>/dev/null || true

log "Install mail stack (Postfix + Dovecot + OpenDKIM)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postfix dovecot-core dovecot-imapd dovecot-lmtpd opendkim opendkim-tools jq 2>/dev/null || \
  apt-get install -y postfix dovecot-core dovecot-imapd opendkim opendkim-tools jq

bash "$QADBAK_DIR/scripts/configure-native-mail.sh" --force

for domain in "$MAIL_DOMAIN" "$FORWARD_DOMAIN"; do
  log "DKIM for $domain"
  bash "$QADBAK_DIR/scripts/apply-domain-mail-security.sh" "$domain" || true
done

log "Sync Postfix maps"
if id "$QADBAK_USER" &>/dev/null; then
  sudo -u "$QADBAK_USER" sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-sync \
    2>/dev/null || echo "    WARN: mail-sync failed" >&2
fi

log "Webmail repair (IMAP + panel features)"
bash "$QADBAK_DIR/scripts/repair-panel-webmail.sh" "$MAIL_DOMAIN" info || true

log "Panel update"
if [[ -f "$QADBAK_DIR/scripts/update-qadbak.sh" ]]; then
  bash "$QADBAK_DIR/scripts/update-qadbak.sh" || echo "    WARN: update-qadbak failed — run manually" >&2
fi

log "Cloudflare DNS checklist"
node "$QADBAK_DIR/scripts/lib/print-cloudflare-mail-dns.mjs" "$FORWARD_DOMAIN" "$MAIL_DOMAIN"

cat <<EOF

Next steps
──────────
1. Add the DNS records above in Cloudflare (grey cloud / DNS only).
2. Set PTR/rDNS at Contabo: $(curl -4 -sf --max-time 5 ifconfig.me 2>/dev/null || echo YOUR_IP) → ${MAIL_HOST}
3. Test inbound:
     sudo bash scripts/test-mail-receive.sh ${MAIL_DOMAIN} info
4. Test forward (after DNS):
     echo test | mail -s "forward test" info@${FORWARD_DOMAIN}
5. Webmail: Panel → Domains → ${MAIL_DOMAIN} → Mail → info → Open webmail
   (login: info@${MAIL_DOMAIN} — use the mailbox password from the panel)

License VPS (outbound license@ emails only):
  sudo MAIL_DOMAIN=inveil.net bash /opt/qadbak-premium/ops/setup-license-mail-postfix.sh

EOF
