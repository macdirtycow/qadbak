#!/usr/bin/env bash
# Setup Postfix/Dovecot mail + webmail for a Qadbak domain (default: inveil.net).
# Prints Cloudflare MX/SPF/DKIM records.
#
#   cd /opt/qadbak && git pull
#   sudo bash scripts/setup-mail.sh
#   sudo bash scripts/setup-mail.sh example.com
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
ENV_FILE="$QADBAK_DIR/.env.local"
MAIL_DOMAIN="${1:-${MAIL_DOMAIN:-inveil.net}}"
MAIL_HOST="${MAIL_HOST:-mail.${MAIL_DOMAIN}}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/setup-mail.sh [domain]" >&2
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

log "Mail domain: ${MAIL_DOMAIN} · hostname: ${MAIL_HOST}"

[[ -f "$QADBAK_DIR/scripts/export-native-domains.sh" ]] && \
  bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true

export MAIL_DOMAIN QADBAK_DIR
node "$QADBAK_DIR/scripts/lib/setup-mail-domain.mjs"

upsert_env QADBAK_MAIL_BACKEND direct
upsert_env QADBAK_MAIL_HOST "$MAIL_HOST"
upsert_env QADBAK_MAIL_AUTODNS false
ORIGIN_IP="$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)"
[[ -n "$ORIGIN_IP" ]] && upsert_env QADBAK_ORIGIN_IP "$ORIGIN_IP"
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE" 2>/dev/null || true

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postfix dovecot-core dovecot-imapd dovecot-lmtpd opendkim opendkim-tools jq 2>/dev/null || \
  apt-get install -y postfix dovecot-core dovecot-imapd opendkim opendkim-tools jq

bash "$QADBAK_DIR/scripts/configure-native-mail.sh" --force
bash "$QADBAK_DIR/scripts/apply-domain-mail-security.sh" "$MAIL_DOMAIN" || true
bash "$QADBAK_DIR/scripts/configure-opendkim-native.sh" 2>/dev/null || true

if id "$QADBAK_USER" &>/dev/null; then
  sudo -u "$QADBAK_USER" sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-sync 2>/dev/null || true
fi

bash "$QADBAK_DIR/scripts/repair-panel-webmail.sh" "$MAIL_DOMAIN" info || true
[[ -f "$QADBAK_DIR/scripts/update-qadbak.sh" ]] && bash "$QADBAK_DIR/scripts/update-qadbak.sh" || true

node "$QADBAK_DIR/scripts/lib/print-cloudflare-mail-dns.mjs" "$MAIL_DOMAIN"

cat <<EOF

Webmail: Panel → Domains → ${MAIL_DOMAIN} → Mail → Open webmail
Cloudflare mail records: DNS only (grey cloud) for MX and mail A.

EOF
