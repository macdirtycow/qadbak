#!/usr/bin/env bash
# Enable Webmin login for a domain (fixes Terminal "has no Webmin login").
# Usage: sudo bash scripts/enable-domain-webmin-login.sh DOMAIN
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash scripts/enable-domain-webmin-login.sh DOMAIN" >&2
  exit 1
fi

if ! command -v virtualmin &>/dev/null; then
  echo "virtualmin CLI not found." >&2
  exit 1
fi

echo "==> Enable Webmin login for $DOMAIN"
virtualmin enable-feature --domain "$DOMAIN" --webmin

echo "==> Test login link"
virtualmin create-login-link --domain "$DOMAIN" | head -1
echo ""
echo "Done. In Qadbak: Domains → $DOMAIN → Terminal → Refresh session."
