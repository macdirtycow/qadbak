#!/usr/bin/env bash
# Nginx server blocks per VirtualMin domain → serve public_html directly (bypass Apache default).
# More specific server_name wins over Qadbak default_server on port 80.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"
APACHE_BACKEND="${APACHE_BACKEND:-127.0.0.1:8080}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-customer-nginx-vhosts.sh" >&2
  exit 1
fi

if [[ -f "$QADBAK_DIR/scripts/detect-web-backend.sh" ]]; then
  APACHE_BACKEND="$(bash "$QADBAK_DIR/scripts/detect-web-backend.sh" 2>/dev/null | tail -1)"
fi

if ! command -v virtualmin &>/dev/null; then
  echo "virtualmin CLI required." >&2
  exit 1
fi

OUT_DIR="/etc/nginx/sites-available"
ENABLED="/etc/nginx/sites-enabled"
mkdir -p "$OUT_DIR" "$ENABLED"

# Remove old generated snippets
rm -f "$OUT_DIR"/qadbak-customer-*.conf 2>/dev/null || true
for link in "$ENABLED"/qadbak-customer-*.conf; do
  [[ -e "$link" ]] && rm -f "$link"
done

mapfile -t DOMAINS < <(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d')
if [[ ${#DOMAINS[@]} -eq 0 ]]; then
  echo "No VirtualMin domains found." >&2
  exit 1
fi

echo "==> Customer nginx vhosts (public_html, PHP → $APACHE_BACKEND)"
for domain in "${DOMAINS[@]}"; do
  [[ -z "$domain" ]] && continue
  VM_USER="$(virtualmin list-domains --domain "$domain" --multiline 2>/dev/null | awk -F': *' '/^Unix username:/ {print $2; exit}')"
  [[ -z "$VM_USER" ]] && VM_USER="${domain%%.*}"
  PUB="/home/$VM_USER/public_html"
  if [[ ! -d "$PUB" ]]; then
    echo "    SKIP $domain — no $PUB" >&2
    continue
  fi

  CONF="$OUT_DIR/qadbak-customer-${domain}.conf"
  cat >"$CONF" <<NGX
# Qadbak — ${domain} → ${PUB}
server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    root ${PUB};
    index index.html index.htm index.php;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~ \\.php(/|\$) {
        proxy_pass http://${APACHE_BACKEND};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGX
  ln -sf "$CONF" "$ENABLED/qadbak-customer-${domain}.conf"
  echo "    $domain → $PUB"
done

nginx -t
systemctl reload nginx
echo "Done. Test: curl -sI -H 'Host: siccamanagement.nl' http://127.0.0.1/ | head -3"
