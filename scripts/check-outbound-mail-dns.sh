#!/usr/bin/env bash
# Check public mail DNS + PTR for outbound deliverability (Gmail/iCloud/etc.).
# Usage: bash scripts/check-outbound-mail-dns.sh inveil.net [origin-ip]
set -euo pipefail

DOMAIN="${1:?domain}"
ORIGIN_IP="${2:-${QADBAK_ORIGIN_IP:-158.220.85.245}}"
MAIL_HOST="${QADBAK_MAIL_HOST:-mail.${DOMAIN}}"

fail=0
ok() { echo "  OK   $*"; }
warn() { echo "  WARN $*"; fail=1; }
miss() { echo "  MISS $*"; fail=1; }

dig_txt() {
  dig +short TXT "$1" 2>/dev/null | tr -d '"' | paste -sd " " -
}

echo "==> Outbound mail DNS: ${DOMAIN}"
echo "    Expected mail host: ${MAIL_HOST}"
echo "    Expected origin IP: ${ORIGIN_IP}"
echo ""

echo "==> MX @${DOMAIN}"
mx="$(dig +short MX "$DOMAIN" 2>/dev/null | sort -n | head -3)"
if [[ -z "$mx" ]]; then
  miss "No MX record — add MX → ${MAIL_HOST}. (priority 10, DNS only in Cloudflare)"
else
  ok "$mx"
  if ! grep -qi "${MAIL_HOST}" <<<"$mx"; then
    warn "MX does not point to ${MAIL_HOST}"
  fi
fi

echo ""
echo "==> A ${MAIL_HOST}"
mail_a="$(dig +short A "$MAIL_HOST" 2>/dev/null | head -1)"
if [[ -z "$mail_a" ]]; then
  miss "No A record for ${MAIL_HOST} — add A → ${ORIGIN_IP} (DNS only)"
elif [[ "$mail_a" == "$ORIGIN_IP" ]]; then
  ok "${MAIL_HOST} → ${mail_a}"
else
  warn "${MAIL_HOST} → ${mail_a} (expected ${ORIGIN_IP})"
fi

echo ""
echo "==> SPF (TXT @${DOMAIN})"
spf="$(dig_txt "$DOMAIN")"
if [[ -z "$spf" ]]; then
  miss "No SPF — add TXT @: v=spf1 mx a ip4:${ORIGIN_IP} ~all"
elif grep -qi 'v=spf1' <<<"$spf"; then
  ok "$spf"
else
  warn "TXT present but no SPF: $spf"
fi

echo ""
echo "==> DMARC (_dmarc.${DOMAIN})"
dmarc="$(dig_txt "_dmarc.${DOMAIN}")"
if [[ -z "$dmarc" ]]; then
  miss "No DMARC — add TXT _dmarc: v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN}; fo=1"
elif grep -qi 'v=DMARC1' <<<"$dmarc"; then
  ok "$dmarc"
else
  warn "Unexpected DMARC: $dmarc"
fi

echo ""
echo "==> DKIM (mail._domainkey.${DOMAIN})"
dkim="$(dig_txt "mail._domainkey.${DOMAIN}")"
if [[ -z "$dkim" ]]; then
  miss "No DKIM — run on VPS: sudo bash scripts/apply-domain-mail-security.sh ${DOMAIN}"
  miss "Then add TXT mail._domainkey from: sudo cat /etc/opendkim/keys/${DOMAIN}/mail.txt"
elif grep -qi 'v=DKIM1' <<<"$dkim"; then
  ok "DKIM record published"
else
  warn "Unexpected DKIM TXT: ${dkim:0:80}..."
fi

echo ""
echo "==> PTR (reverse DNS for ${ORIGIN_IP})"
ptr="$(dig +short -x "$ORIGIN_IP" 2>/dev/null | sed 's/\.$//' | head -1)"
if [[ -z "$ptr" ]]; then
  miss "No PTR — set reverse DNS in Contabo panel → ${MAIL_HOST}"
elif [[ "$ptr" == "$MAIL_HOST" ]] || [[ "$ptr" == *"${DOMAIN}"* ]]; then
  ok "${ORIGIN_IP} → ${ptr}"
else
  warn "PTR is ${ptr} — iCloud/Gmail prefer ${MAIL_HOST} (Contabo → Reverse DNS)"
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "All checks passed. Test: send from support@${DOMAIN} to mail-tester.com or your iCloud."
else
  echo "Fix WARN/MISS items in Cloudflare (grey cloud for MX/mail) + Contabo PTR, then re-run."
  echo "On VPS: cd /opt/qadbak && sudo bash scripts/setup-mail.sh ${DOMAIN}"
fi
exit "$fail"
