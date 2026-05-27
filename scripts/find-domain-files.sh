#!/usr/bin/env bash
# Locate website files, backups, and nginx for a Qadbak domain (run on VPS as root).
# Usage: sudo bash scripts/find-domain-files.sh omiiba.dev
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash scripts/find-domain-files.sh DOMAIN" >&2
  exit 1
fi
if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER=""
REG="$ROOT/data/native-domains.json"

echo "=== Qadbak domain file search: $DOMAIN ==="
echo "Server: $(hostname -f 2>/dev/null || hostname) — $(curl -fsS --max-time 2 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""

if [[ -f "$REG" ]] && command -v jq &>/dev/null; then
  USER="$(jq -r --arg d "$DOMAIN" '.[] | select(.name==$d) | .user' "$REG" 2>/dev/null | head -1)"
  echo "native-domains.json → user: ${USER:-<not listed>}"
fi

for hint in /home/*/.qadbak-domain; do
  [[ -f "$hint" ]] || continue
  if [[ "$(tr -d '\r\n' <"$hint" | head -1)" == "$DOMAIN" ]]; then
    u="$(basename "$(dirname "$hint")")"
    echo ".qadbak-domain → /home/$u ($hint)"
    [[ -z "$USER" ]] && USER="$u"
  fi
done

if command -v virtualmin &>/dev/null; then
  vu="$(virtualmin list-domains --domain "$DOMAIN" --multiline 2>/dev/null \
    | awk -F': *' '/^Unix username:/ {print $2; exit}')"
  if [[ -n "$vu" ]]; then
    echo "virtualmin → user: $vu"
    [[ -z "$USER" ]] && USER="$vu"
  fi
fi

[[ -z "$USER" ]] && USER="${DOMAIN%%.*}"
echo ""
echo "Resolved unix user: $USER"
HOME="/home/$USER"
PUB="$HOME/public_html"
BACKUPS="$HOME/backups"

if ! id "$USER" &>/dev/null; then
  echo "WARN: unix user $USER does not exist on this server."
else
  echo ""
  echo "--- Website: $PUB ---"
  if [[ -d "$PUB" ]]; then
    du -sh "$PUB" 2>/dev/null || true
    ls -la "$PUB" 2>/dev/null | head -25
    if [[ -f "$PUB/index.html" ]]; then
      echo ""
      echo "index.html (first 15 lines):"
      head -15 "$PUB/index.html"
      if grep -qF 'hosted on Qadbak' "$PUB/index.html" 2>/dev/null; then
        echo ""
        echo ">>> PLACEHOLDER: Qadbak default landing — real site not migrated here yet."
      fi
    else
      echo "No index.html in public_html."
    fi
  else
    echo "public_html missing."
  fi

  echo ""
  echo "--- Backups: $BACKUPS ---"
  if [[ -d "$BACKUPS" ]]; then
    ls -lah "$BACKUPS" 2>/dev/null || true
  else
    echo "(no backups dir)"
  fi
fi

echo ""
echo "--- Other /home dirs mentioning $DOMAIN ---"
for hint in /home/*/.qadbak-domain; do
  [[ -f "$hint" ]] || continue
  echo "  $(cat "$hint" 2>/dev/null) → $(dirname "$hint")"
done
grep -rl "$DOMAIN" /home/*/public_html/index.html 2>/dev/null | head -10 || true

echo ""
echo "--- Nginx vhosts ---"
grep -rl "server_name.*$DOMAIN" /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null | head -10 || echo "(none)"

echo ""
echo "--- DNS hint (this server's public IP) ---"
echo "  A-record for $DOMAIN should point here if this is the live host."
