#!/usr/bin/env bash
# Wire OpenDKIM + Postfix milters for Qadbak native mail (outbound signing).
# Idempotent — safe to re-run from setup-mail.sh or apply-domain-mail-security.sh.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
DKIM_DIR="/etc/opendkim"
# OpenDKIM Socket= uses inet:PORT@HOST; Postfix smtpd_milters needs inet:HOST:PORT.
OPENDKIM_SOCKET="${QADBAK_OPENDKIM_SOCKET:-inet:8891@127.0.0.1}"
POSTFIX_MILTER="${QADBAK_POSTFIX_MILTER:-inet:127.0.0.1:8891}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

if ! command -v opendkim &>/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq opendkim opendkim-tools
fi

mkdir -p "$DKIM_DIR/keys" /run/opendkim
touch "$DKIM_DIR/KeyTable" "$DKIM_DIR/SigningTable" "$DKIM_DIR/TrustedHosts"
chown -R opendkim:opendkim "$DKIM_DIR" /run/opendkim 2>/dev/null || true
chmod 700 "$DKIM_DIR/keys"

# Trusted hosts for signing (localhost + any domain keys we manage).
if ! grep -q '^127\.0\.0\.1$' "$DKIM_DIR/TrustedHosts" 2>/dev/null; then
  cat >"$DKIM_DIR/TrustedHosts" <<'EOF'
127.0.0.1
localhost
::1
EOF
fi

cat >/etc/opendkim.conf <<EOF
# Managed by scripts/configure-opendkim-native.sh
Syslog                  yes
SyslogSuccess           yes
LogWhy                  yes
UMask                   002
Mode                    sv
Canonicalization        relaxed/simple
OversignHeaders         From
SubDomains              no
AutoRestart             yes
AutoRestartRate         10/1M
Background              yes
DNSTimeout              5
SignatureAlgorithm      rsa-sha256
Socket                  ${OPENDKIM_SOCKET}
PidFile                 /run/opendkim/opendkim.pid
UserID                  opendkim
KeyTable                file:${DKIM_DIR}/KeyTable
SigningTable            refile:${DKIM_DIR}/SigningTable
ExternalIgnoreList      refile:${DKIM_DIR}/TrustedHosts
InternalHosts           refile:${DKIM_DIR}/TrustedHosts
EOF

if [[ -f /etc/default/opendkim ]]; then
  sed -i "s|^SOCKET=.*|SOCKET=${OPENDKIM_SOCKET}|" /etc/default/opendkim
  grep -q '^SOCKET=' /etc/default/opendkim || echo "SOCKET=${OPENDKIM_SOCKET}" >>/etc/default/opendkim
fi

if command -v postconf &>/dev/null; then
  postconf -e "milter_default_action = accept"
  postconf -e "milter_protocol = 6"
  postconf -e "smtpd_milters = ${POSTFIX_MILTER}"
  postconf -e "non_smtpd_milters = ${POSTFIX_MILTER}"
fi

systemctl enable opendkim >/dev/null 2>&1 || true
systemctl restart opendkim
systemctl reload postfix 2>/dev/null || systemctl restart postfix 2>/dev/null || true

echo "OK — OpenDKIM socket ${OPENDKIM_SOCKET} · Postfix milters ${POSTFIX_MILTER}"
