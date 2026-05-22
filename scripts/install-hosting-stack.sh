#!/usr/bin/env bash
# One-shot hosting setup for Qadbak panel servers (install + updates).
# - Apache backend for VirtualMin
# - nginx: panel host → Qadbak, customer domains → public_html
# - Webmin login on all domains (Terminal / embeds)
# - Disable Ubuntu Apache default site
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/install-hosting-stack.sh" >&2
  exit 1
fi

# shellcheck source=lib/virtualmin-domains.sh
source "$QADBAK_DIR/scripts/lib/virtualmin-domains.sh" 2>/dev/null || true

if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^(QADBAK_PUBLIC_HOST|PANEL_HOST|QADBAK_ORIGIN_IP)=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
fi
export PANEL_HOST="${PANEL_HOST:-${QADBAK_PUBLIC_HOST:-$(hostname -f 2>/dev/null || hostname)}}"
export SERVER_FQDN="${SERVER_FQDN:-$(hostname -f 2>/dev/null || hostname)}"

FIRST_DOMAIN="$(first_virtualmin_domain 2>/dev/null || true)"
export DETECT_DOMAIN="${DETECT_DOMAIN:-$FIRST_DOMAIN}"

echo "==> Firewall: HTTP/HTTPS"
bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 80
bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 443

echo "==> Apache backend (VirtualMin behind nginx)"
if [[ -f "$QADBAK_DIR/scripts/ensure-apache-backend.sh" ]]; then
  bash "$QADBAK_DIR/scripts/ensure-apache-backend.sh" || true
fi

echo "==> nginx (panel → Qadbak; all VirtualMin domains → public_html)"
bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh"

echo "==> Webmin embed proxy (Terminal / iframe modules)"
if [[ -f "$QADBAK_DIR/scripts/configure-webmin-embed.sh" ]]; then
  bash "$QADBAK_DIR/scripts/configure-webmin-embed.sh" || true
fi

echo "==> Native terminal (bash as domain user, no Webmin UI)"
if [[ -f "$QADBAK_DIR/scripts/install-node-build-deps.sh" ]]; then
  bash "$QADBAK_DIR/scripts/install-node-build-deps.sh" || true
fi
if [[ -f "$QADBAK_DIR/scripts/configure-domain-terminal-sudo.sh" ]]; then
  bash "$QADBAK_DIR/scripts/configure-domain-terminal-sudo.sh" || true
fi

if command -v virtualmin &>/dev/null; then
  echo "==> Webmin login for all VirtualMin domains (Terminal, Webmin embeds)"
  while read -r d; do
    [[ -z "$d" ]] && continue
    virtualmin enable-feature --domain "$d" --webmin 2>/dev/null || true
  done < <(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d')
fi

echo "==> Hosting stack applied"
if [[ -n "$FIRST_DOMAIN" ]]; then
  echo "    Test: curl -sI -H 'Host: $FIRST_DOMAIN' http://127.0.0.1/ | head -3"
else
  echo "    No VirtualMin domains yet — create one in the panel, then run:"
  echo "    sudo bash $QADBAK_DIR/scripts/install-hosting-stack.sh"
fi
