#!/usr/bin/env bash
# Diagnose why inbound SMTP (port 25) fails — "lost connection during initial greeting".
# Usage: sudo bash scripts/check-inbound-smtp.sh <domain>
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:-}"
ORIGIN_IP="${QADBAK_ORIGIN_IP:-$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 <domain>" >&2
  exit 1
}
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash $0 example.com" >&2
  exit 1
fi

fail=0
ok() { echo "  OK   $*"; }
warn() { echo "  WARN $*"; fail=1; }
miss() { echo "  MISS $*"; fail=1; }

smtp_banner() {
  local host="$1"
  timeout 8 bash -c "
    exec 3<>/dev/tcp/${host}/25
    IFS= read -r -t 6 line <&3 || exit 1
    printf '%s\n' \"\$line\"
    printf 'QUIT\r\n' >&3
  " 2>/dev/null || true
}

echo "==> Services"
for svc in postfix dovecot opendkim; do
  st="$(systemctl is-active "$svc" 2>/dev/null || echo inactive)"
  if [[ "$st" == "active" ]]; then
    ok "$svc is active"
  else
    miss "$svc is $st — run: sudo bash $QADBAK_DIR/scripts/setup-mail.sh $DOMAIN"
  fi
done

echo ""
echo "==> Postfix config"
if command -v postconf &>/dev/null; then
  ok "myhostname=$(postconf -h myhostname 2>/dev/null || echo '?')"
  ok "inet_interfaces=$(postconf -h inet_interfaces 2>/dev/null || echo '?')"
  milters="$(postconf -h smtpd_milters 2>/dev/null || true)"
  ok "smtpd_milters=${milters:-'(none)'}"
  if [[ -n "$milters" && "$milters" == *"@"* ]]; then
    warn "smtpd_milters uses OpenDKIM socket format — run: sudo bash $QADBAK_DIR/scripts/configure-opendkim-native.sh"
  fi
else
  miss "postconf not found — install postfix"
fi

echo ""
echo "==> Port 25 listener"
if ss -tlnp 2>/dev/null | grep -q ':25 '; then
  ok "$(ss -tlnp | grep ':25 ' | head -1)"
else
  miss "nothing listening on TCP 25 — run: sudo bash $QADBAK_DIR/scripts/configure-native-mail.sh --force"
fi

echo ""
echo "==> SMTP greeting (220 banner)"
local_banner="$(smtp_banner 127.0.0.1)"
if grep -q '^220 ' <<<"$local_banner"; then
  ok "localhost: $local_banner"
else
  miss "localhost:25 no 220 banner — postfix broken or not bound"
  echo "       Recent logs:" >&2
  journalctl -u postfix --no-pager -n 15 2>/dev/null | sed 's/^/         /' >&2 || true
fi

if [[ -n "$ORIGIN_IP" ]]; then
  ext_banner="$(smtp_banner "$ORIGIN_IP")"
  if grep -q '^220 ' <<<"$ext_banner"; then
    ok "public $ORIGIN_IP: $ext_banner"
  else
    warn "public $ORIGIN_IP:25 no 220 — open TCP 25 in UFW + Contabo firewall"
  fi
fi

echo ""
echo "==> Firewall"
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then
  if ufw status | grep -qE '25/tcp.*ALLOW'; then
    ok "UFW allows 25/tcp"
  else
    warn "UFW active but 25/tcp not allowed — run: ufw allow 25/tcp"
  fi
else
  ok "UFW inactive or not installed"
fi
echo "  Note: Contabo cloud firewall must also allow inbound TCP 25 (Network → Firewall)."

echo ""
echo "==> Domain maps (inbound RCPT)"
if [[ -f /etc/postfix/qadbak-domains ]]; then
  if postmap -q "$DOMAIN" hash:/etc/postfix/qadbak-domains 2>/dev/null | grep -q .; then
    ok "$DOMAIN in qadbak-domains"
  else
    warn "$DOMAIN missing from qadbak-domains — run mail-sync / setup-mail.sh"
  fi
else
  miss "/etc/postfix/qadbak-domains missing"
fi

if [[ -f /etc/postfix/qadbak-vmailbox ]]; then
  if postmap -q "info@${DOMAIN}" hash:/etc/postfix/qadbak-vmailbox 2>/dev/null | grep -q .; then
    ok "info@${DOMAIN} mailbox mapped"
  else
    warn "info@${DOMAIN} not in qadbak-vmailbox — create mailbox in panel → Mail → Accounts"
  fi
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Inbound SMTP looks healthy. Test from outside:"
  echo "  nc -zv ${ORIGIN_IP:-YOUR_IP} 25"
  echo "  sudo bash $QADBAK_DIR/scripts/test-mail-receive.sh $DOMAIN info"
else
  echo "Fix MISS/WARN above, then:"
  echo "  sudo bash $QADBAK_DIR/scripts/repair-domain-mail.sh $DOMAIN info"
fi
exit "$fail"
