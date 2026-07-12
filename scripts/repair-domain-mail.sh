#!/usr/bin/env bash
# Install/repair Postfix/Dovecot on this VPS and diagnose public mail DNS.
# Usage: sudo bash scripts/repair-domain-mail.sh [domain] [mailbox-local-part]
# Example: sudo bash scripts/repair-domain-mail.sh inveil.net info
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:-inveil.net}"
MAIL_USER="${2:-info}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 [domain] [mailbox]" >&2
  exit 1
}

echo "==> Mail stack (Postfix, Dovecot, OpenDKIM)"
bash "$QADBAK_DIR/scripts/setup-mail.sh" "$DOMAIN"

ORIGIN_IP="$(grep '^QADBAK_ORIGIN_IP=' "$QADBAK_DIR/.env.local" 2>/dev/null | cut -d= -f2- || true)"
ORIGIN_IP="${ORIGIN_IP:-$(curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null || true)}"

echo ""
echo "==> Inbound SMTP (port 25 — iCloud/Gmail need 220 banner)"
bash "$QADBAK_DIR/scripts/check-inbound-smtp.sh" "$DOMAIN" || true

echo ""
echo "==> Public DNS (must pass before send/receive works)"
set +e
bash "$QADBAK_DIR/scripts/check-outbound-mail-dns.sh" "$DOMAIN" "$ORIGIN_IP"
DNS_RC=$?
set -e

if [[ -n "$MAIL_USER" && -f "$QADBAK_DIR/scripts/test-mail-receive.sh" ]]; then
  echo ""
  echo "==> Local delivery test (${MAIL_USER}@${DOMAIN})"
  bash "$QADBAK_DIR/scripts/test-mail-receive.sh" "$DOMAIN" "$MAIL_USER" || true
fi

if [[ "$DNS_RC" -ne 0 ]]; then
  echo ""
  echo "DNS is not ready — fix Cloudflare + Contabo PTR above, wait 2–5 min, then re-run:" >&2
  echo "  bash $QADBAK_DIR/scripts/check-outbound-mail-dns.sh $DOMAIN $ORIGIN_IP" >&2
  exit "$DNS_RC"
fi

echo ""
echo "OK — stack configured and public DNS looks good. Test outbound:"
echo "  sudo bash $QADBAK_DIR/scripts/test-mail-send.sh $DOMAIN $MAIL_USER you@gmail.com"
