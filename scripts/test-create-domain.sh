#!/usr/bin/env bash
# Test VirtualMin create-domain + list-domains (run on VPS as root).
set -euo pipefail
DOMAIN="${1:-}"
PASS="${2:-}"
if [[ -z "$DOMAIN" || -z "$PASS" ]]; then
  echo "Usage: sudo bash scripts/test-create-domain.sh DOMAIN PASSWORD" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER="$(echo "$DOMAIN" | cut -d. -f1 | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"

echo "==> create-domain $DOMAIN"
if command -v virtualmin &>/dev/null; then
  virtualmin create-domain --domain "$DOMAIN" --pass "$PASS" --user "$USER" \
    --unix --dir --web --dns --mail --mysql 2>&1 || true
  echo ""
  echo "==> list-domains"
  virtualmin list-domains --multiline 2>&1 | head -40
else
  echo "virtualmin CLI not found; using remote.cgi via Qadbak env"
  sudo -u qadbak bash -c "cd '$ROOT' && source .env.local && \
    curl -sk -u \"\$VIRTUALMIN_USER:\$VIRTUALMIN_PASS\" \
    -d 'program=create-domain&json=1&domain=$DOMAIN&pass=$PASS&user=$USER&unix=1&dir=1&web=1&dns=1&mail=1&mysql=1' \
    \"\$VIRTUALMIN_URL\" | head -c 2000"
  echo ""
  curl -sk -u "$(grep VIRTUALMIN_USER "$ROOT/.env.local" | cut -d= -f2-):$(grep VIRTUALMIN_PASS "$ROOT/.env.local" | cut -d= -f2-)" \
    -d "program=list-domains&json=1&multiline" \
    "$(grep VIRTUALMIN_URL "$ROOT/.env.local" | cut -d= -f2-)" | head -c 3000
fi

ls -la /etc/webmin/virtual-server/domains/ 2>/dev/null | tail -5 || true
