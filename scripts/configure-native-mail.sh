#!/usr/bin/env bash
# Postfix + Dovecot for Qadbak native mail (virtual domains, Maildir, IMAP, SMTP submission).
# Run as root after install or when mail stops working:
#   sudo bash scripts/configure-native-mail.sh
#   sudo bash scripts/configure-native-mail.sh sync   # refresh virtual_domains from registry
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
[[ -d "$QADBAK_DIR" ]] || QADBAK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ACTION="${1:-apply}"
STAMP="/var/lib/qadbak/native-mail-configured"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-native-mail.sh" >&2
  exit 1
fi

if [[ "$ACTION" == "apply" ]] && [[ -f "$STAMP" ]]; then
  sync_domains() {
    REG="$QADBAK_DIR/data/native-domains.json"
    [[ -f "$REG" ]] || return 0
    python3 - "$REG" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    rows = json.load(f)
domains = sorted({
    r["name"].lower()
    for r in rows
    if isinstance(r, dict) and r.get("name") and not r.get("disabled")
    and r.get("type", "top") != "alias"
})
with open("/etc/postfix/virtual_domains", "w") as out:
    out.write("\n".join(domains))
    if domains:
        out.write("\n")
PY
    postmap /etc/postfix/virtual 2>/dev/null || true
  }
  sync_domains
  echo "OK — native mail already configured (stamp); domains synced"
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq postfix dovecot-core dovecot-imapd dovecot-lmtpd 2>/dev/null || true

touch /etc/postfix/virtual
touch /etc/postfix/virtual_domains
chmod 640 /etc/postfix/virtual /etc/postfix/virtual_domains 2>/dev/null || true
chown root:postfix /etc/postfix/virtual /etc/postfix/virtual_domains 2>/dev/null || true

postconf -e 'home_mailbox = Maildir/'
postconf -e 'virtual_alias_maps = hash:/etc/postfix/virtual'
postconf -e 'virtual_mailbox_domains = /etc/postfix/virtual_domains'
postconf -X virtual_alias_domains 2>/dev/null || true
postconf -X virtual_mailbox_maps 2>/dev/null || true
postconf -X virtual_mailbox_base 2>/dev/null || true
postconf -X mailbox_command 2>/dev/null || true
postconf -X virtual_transport 2>/dev/null || true
postconf -e 'inet_interfaces = all'
postconf -e 'local_recipient_maps = unix:passwd.byname, $virtual_alias_maps'

# Accept mail for virtual domains; allow SASL-authenticated senders.
postconf -e 'smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination'
postconf -e 'smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination'
postconf -e 'smtpd_sasl_auth_enable = yes'
postconf -e 'smtpd_sasl_type = dovecot'
postconf -e 'smtpd_sasl_path = private/auth'
postconf -e 'smtpd_tls_security_level = may'
postconf -e 'smtp_tls_security_level = may'

HOST="$(hostname -f 2>/dev/null || hostname)"
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  MAIL_HOST="$(grep -E '^QADBAK_MAIL_HOST=' "$QADBAK_DIR/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
  [[ -n "$MAIL_HOST" ]] && HOST="$MAIL_HOST"
fi
postconf -e "myhostname = ${HOST}"
if postconf mydestination | grep -q 'mydestination ='; then
  postconf -e 'mydestination = localhost, localhost.localdomain'
fi

postmap /etc/postfix/virtual 2>/dev/null || true
systemctl enable postfix dovecot 2>/dev/null || true

DOVECOT_SNIPPET="/etc/dovecot/conf.d/99-qadbak-native.conf"
cat >"$DOVECOT_SNIPPET" <<'EOF'
# Qadbak native mail — Maildir in user homes, system passwd auth, Postfix SASL
protocols = imap pop3 lmtp

mail_location = maildir:~/Maildir
mail_privileged_group = mail
namespace inbox {
  inbox = yes
}

ssl = yes
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key

auth_mechanisms = plain login
disable_plaintext_auth = yes

passdb {
  driver = passwd
}
userdb {
  driver = passwd
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

protocol lmtp {
  mail_plugins = $mail_plugins
}
EOF

# Enable submission (587) and imaps (993) in master.cf if missing.
MASTER="/etc/postfix/master.cf"
if [[ -f "$MASTER" ]]; then
  if ! grep -q '^submission inet' "$MASTER" 2>/dev/null; then
    cat >>"$MASTER" <<'EOF'

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
EOF
  fi
fi

if ! doveconf -n >/dev/null 2>&1; then
  echo "WARN: doveconf check failed — review $DOVECOT_SNIPPET" >&2
  doveconf -n 2>&1 | tail -20 >&2 || true
fi
systemctl restart dovecot 2>/dev/null || systemctl restart dovecot-core 2>/dev/null || true
systemctl reload postfix 2>/dev/null || systemctl restart postfix 2>/dev/null || true

if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow 25/tcp comment 'SMTP inbound' 2>/dev/null || true
  ufw allow 587/tcp comment 'SMTP submission' 2>/dev/null || true
  ufw allow 993/tcp comment 'IMAPS' 2>/dev/null || true
fi

if [[ -x "$QADBAK_DIR/scripts/open-host-firewall-port.sh" ]]; then
  bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 25 2>/dev/null || true
fi

sync_domains() {
  REG="$QADBAK_DIR/data/native-domains.json"
  if [[ ! -f "$REG" ]]; then
    echo "WARN: no $REG — export domains first" >&2
    return 0
  fi
  python3 - "$REG" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    rows = json.load(f)
domains = sorted({
    r["name"].lower()
    for r in rows
    if isinstance(r, dict) and r.get("name") and not r.get("disabled")
    and r.get("type", "top") != "alias"
})
with open("/etc/postfix/virtual_domains", "w") as out:
    out.write("\n".join(domains))
    if domains:
        out.write("\n")
print(f"synced {len(domains)} domain(s) -> /etc/postfix/virtual_domains")
PY
  postmap /etc/postfix/virtual 2>/dev/null || true
  systemctl reload postfix 2>/dev/null || true
}

if [[ "$ACTION" == "sync" ]]; then
  sync_domains
  echo "OK — virtual_domains synced"
  exit 0
fi

sync_domains

mkdir -p /var/lib/qadbak
touch "$STAMP"

echo "OK — native mail stack configured (Postfix virtual + Dovecot Maildir)"
echo "    Maps: /etc/postfix/virtual"
echo "    Domains: /etc/postfix/virtual_domains"
echo "    Test: sudo bash scripts/check-native-mail.sh DOMAIN USER"
