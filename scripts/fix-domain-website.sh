#!/usr/bin/env bash
# Fix website unreachable (Cloudflare 523 / origin down) for one VirtualMin domain.
# Run on VPS: sudo bash scripts/fix-domain-website.sh siccamanagement.nl
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash scripts/fix-domain-website.sh DOMAIN" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Firewall: allow HTTP/HTTPS on host"
bash "$ROOT/scripts/open-host-firewall-port.sh" 80
bash "$ROOT/scripts/open-host-firewall-port.sh" 443

echo "==> Start web server (Apache or Nginx)"
for svc in apache2 httpd nginx; do
  if systemctl list-unit-files "$svc.service" &>/dev/null 2>&1; then
    systemctl enable "$svc" 2>/dev/null || true
    systemctl start "$svc" 2>/dev/null || true
    systemctl is-active "$svc" && echo "    $svc: running" || echo "    $svc: not active"
  fi
done

if command -v apache2ctl &>/dev/null; then
  apache2ctl configtest 2>&1 || true
elif command -v apachectl &>/dev/null; then
  apachectl configtest 2>&1 || true
fi

if command -v virtualmin &>/dev/null; then
  echo "==> VirtualMin: enable web + validate $DOMAIN"
  virtualmin enable-feature --domain "$DOMAIN" --web 2>/dev/null || true
  virtualmin validate-domains --domain "$DOMAIN" 2>&1 || true
  virtualmin modify-web --domain "$DOMAIN" 2>/dev/null || true
else
  echo "virtualmin CLI not found — skip VM steps"
fi

for svc in apache2 httpd nginx; do
  systemctl reload "$svc" 2>/dev/null || systemctl restart "$svc" 2>/dev/null || true
done

ORIGIN_IP="${QADBAK_ORIGIN_IP:-}"
if [[ -z "$ORIGIN_IP" ]]; then
  ORIGIN_IP="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
fi

echo ""
echo "==> Local probe (Apache on this server)"
if curl -sI --max-time 5 -H "Host: $DOMAIN" http://127.0.0.1/ | head -1; then
  echo "    OK — web server answers locally for Host: $DOMAIN"
else
  echo "    FAIL — no HTTP response on 127.0.0.1 for Host: $DOMAIN"
  echo "    Check: virtualmin list-domains | grep -i $DOMAIN"
  echo "    Logs: tail -50 /var/log/apache2/error.log"
fi

echo ""
echo "==> Cloudflare (if you use orange-cloud proxy)"
echo "    A record @ and www → origin IP: ${ORIGIN_IP:-YOUR_VPS_IP}"
echo "    Contabo firewall: allow inbound TCP 80 and 443"
echo "    SSL mode: Full (after origin has HTTPS) or Flexible (HTTP origin only)"
echo ""
echo "Done."
