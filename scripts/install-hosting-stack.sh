#!/usr/bin/env bash
# One-shot hosting setup for Qadbak panel servers (install + updates).
# - Apache backend behind nginx
# - nginx: panel host → Qadbak, customer domains → public_html
# - Native terminals (no legacy panel embeds)
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
  source <(grep -E '^(QADBAK_PUBLIC_HOST|PANEL_HOST|QADBAK_ORIGIN_IP|QADBAK_PROVISIONER|QADBAK_NATIVE_INSTALL|QADBAK_DISABLE_WEBMIN)=' "$QADBAK_DIR/.env.local" 2>/dev/null | sed 's/^/export /') || true
fi
export PANEL_HOST="${PANEL_HOST:-${QADBAK_PUBLIC_HOST:-$(hostname -f 2>/dev/null || hostname)}}"
export SERVER_FQDN="${SERVER_FQDN:-$(hostname -f 2>/dev/null || hostname)}"

if [[ "${QADBAK_DISABLE_WEBMIN:-}" == "1" || "${QADBAK_DISABLE_WEBMIN:-}" == "true" ]] || [[ "${QADBAK_PROVISIONER:-}" == "native" ]]; then
  export QADBAK_NATIVE_INSTALL=1
fi

FIRST_DOMAIN="$(first_panel_domain 2>/dev/null || true)"
export DETECT_DOMAIN="${DETECT_DOMAIN:-$FIRST_DOMAIN}"

echo "==> Firewall: HTTP/HTTPS"
bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 80
bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 443

echo "==> Apache backend (127.0.0.1:8080 behind nginx)"
if [[ -f "$QADBAK_DIR/scripts/ensure-apache-backend.sh" ]]; then
  bash "$QADBAK_DIR/scripts/ensure-apache-backend.sh" || true
fi

echo "==> nginx (panel → Qadbak; domains → public_html)"
bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh"

if [[ "${QADBAK_NATIVE_INSTALL:-}" != "1" ]]; then
  echo "==> Legacy panel embed proxy (hybrid installs only)"
  if [[ -f "$QADBAK_DIR/scripts/configure-webmin-embed.sh" ]]; then
    bash "$QADBAK_DIR/scripts/configure-webmin-embed.sh" || true
  fi
  if command -v virtualmin &>/dev/null; then
    echo "==> Legacy domain login features (hybrid)"
    while read -r d; do
      [[ -z "$d" ]] && continue
      virtualmin enable-feature --domain "$d" --webmin 2>/dev/null || true
    done < <(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d')
  fi
else
  echo "==> Native mode — no legacy panel embeds"
fi

echo "==> Native terminal (domain unix users)"
if [[ -f "$QADBAK_DIR/scripts/install-node-build-deps.sh" ]]; then
  bash "$QADBAK_DIR/scripts/install-node-build-deps.sh" || true
fi
if [[ -f "$QADBAK_DIR/scripts/configure-domain-terminal-sudo.sh" ]]; then
  bash "$QADBAK_DIR/scripts/configure-domain-terminal-sudo.sh" || true
fi

echo "==> Hosting stack applied"
if [[ -n "$FIRST_DOMAIN" ]]; then
  echo "    Test: curl -sI -H 'Host: $FIRST_DOMAIN' http://127.0.0.1/ | head -3"
else
  echo "    No domains in registry yet — create one in the panel, then re-run:"
  echo "    sudo bash $QADBAK_DIR/scripts/install-hosting-stack.sh"
fi
