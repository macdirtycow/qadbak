#!/usr/bin/env bash
# Check public mail DNS + PTR for inbound/outbound mail (Gmail/iCloud/etc.).
# Usage: bash scripts/check-outbound-mail-dns.sh inveil.net [origin-ip]
set -euo pipefail

DOMAIN="${1:?domain}"
ORIGIN_IP="${2:-${QADBAK_ORIGIN_IP:-}}"
if [[ -z "$ORIGIN_IP" ]]; then
  ORIGIN_IP="$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)"
fi
if [[ -z "$ORIGIN_IP" ]]; then
  echo "Set QADBAK_ORIGIN_IP or pass VPS IP as second argument." >&2
  exit 1
fi
MAIL_HOST="${QADBAK_MAIL_HOST:-mail.${DOMAIN}}"

fail=0
ok() { echo "  OK   $*"; }
warn() { echo "  WARN $*"; fail=1; }
miss() { echo "  MISS $*"; fail=1; }

dig_txt() {
  dig +short TXT "$1" 2>/dev/null | tr -d '"' | paste -sd " " -
}

is_cloudflare_proxy_ip() {
  local ip="$1"
  [[ "$ip" =~ ^104\.(1[6-9]|2[0-9]|3[01])\..* ]] && return 0
  [[ "$ip" =~ ^172\.6[67]\..* ]] && return 0
  [[ "$ip" =~ ^162\.158\. ]] && return 0
  [[ "$ip" =~ ^141\.101\. ]] && return 0
  return 1
}

print_cloudflare_fixes() {
  cat <<EOF

--- Fix in Cloudflare (zone: ${DOMAIN}) ---

1. Email → Email Routing → DISABLE for ${DOMAIN}
   (Current MX looks like Cloudflare routing, not your VPS.)

2. DNS records (Proxy = DNS only / grey cloud for mail):

   Type  Name              Content
   MX    @                 ${MAIL_HOST}.   Priority 10   DNS only
   A     mail              ${ORIGIN_IP}                  DNS only
   TXT   @                 v=spf1 mx a ip4:${ORIGIN_IP} ~all
   TXT   _dmarc            v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN}; fo=1
   TXT   mail._domainkey   (from VPS: sudo cat /etc/opendkim/keys/${DOMAIN}/mail.txt)

3. Contabo panel → VPS → Reverse DNS (PTR) → ${MAIL_HOST}

4. Re-run: bash scripts/check-outbound-mail-dns.sh ${DOMAIN} ${ORIGIN_IP}

EOF
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
  if grep -qiE '_dc-mx|\.mx\.cloudflare\.net|route\.cloudflare' <<<"$mx"; then
    warn "MX uses Cloudflare Email Routing — disable Email Routing; mail must go to ${MAIL_HOST}"
  fi
  if grep -qi 'mail\.qadbak\.com' <<<"$mx"; then
    warn "MX points to mail.qadbak.com — change to ${MAIL_HOST} for ${DOMAIN}"
  fi
fi

echo ""
echo "==> A ${MAIL_HOST}"
mail_a="$(dig +short A "$MAIL_HOST" 2>/dev/null | head -1)"
mail_all="$(dig +short A "$MAIL_HOST" 2>/dev/null | paste -sd " " -)"
if [[ -z "$mail_a" ]]; then
  miss "No A record for ${MAIL_HOST} — add A → ${ORIGIN_IP} (DNS only)"
elif [[ "$mail_a" == "$ORIGIN_IP" ]]; then
  ok "${MAIL_HOST} → ${mail_a}"
elif is_cloudflare_proxy_ip "$mail_a"; then
  warn "${MAIL_HOST} → ${mail_all} (Cloudflare proxy — SMTP/IMAP cannot work; set A → ${ORIGIN_IP}, DNS only)"
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
  if ! grep -q "$ORIGIN_IP" <<<"$spf"; then
    warn "SPF exists but may not include VPS IP ${ORIGIN_IP}"
  fi
else
  warn "TXT present but no SPF: $spf"
fi

echo ""
echo "==> DMARC (_dmarc.${DOMAIN})"
dmarc="$(dig_txt "_dmarc.${DOMAIN}")"
if [[ -z "$dmarc" ]]; then
  miss "No DMARC — add TXT _dmarc: v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN}; fo=1"
elif grep -qi 'v=DMARC1' <<<"$dmarc" && grep -q ';' <<<"$dmarc"; then
  ok "$dmarc"
elif grep -qi 'v=DMARC1' <<<"$dmarc"; then
  warn "DMARC uses commas or bad format — use semicolons: v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN}; fo=1"
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
  echo "Fix WARN/MISS items below, then re-run this script."
  print_cloudflare_fixes
  echo "On VPS: cd /opt/qadbak && sudo bash scripts/repair-domain-mail.sh ${DOMAIN}"
fi
exit "$fail"
