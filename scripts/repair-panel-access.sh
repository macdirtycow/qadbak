#!/usr/bin/env bash
# Repair Qadbak panel reachability after git update / phase-8 nginx changes.
# Fixes Cloudflare 520 (empty origin), broken panel.<domain> vhosts, and :11000 alt port.
#
# Usage (on VPS as root):
#   sudo bash scripts/repair-panel-access.sh
#   sudo bash scripts/fix-panel-now.sh siccamanagement.nl
#   sudo bash scripts/repair-panel-access.sh --check-only
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
CHECK_ONLY=0
DOMAINS=()

for arg in "$@"; do
  case "$arg" in
    --check-only|-n) CHECK_ONLY=1 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      DOMAINS+=("$arg")
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/repair-panel-access.sh [domain ...]" >&2
  exit 1
fi

if [[ ! -d "$QADBAK_DIR" ]]; then
  echo "Missing $QADBAK_DIR" >&2
  exit 1
fi

# shellcheck source=scripts/lib/read-env-local.sh
source "$QADBAK_DIR/scripts/lib/read-env-local.sh" 2>/dev/null || true
PANEL_PORT="$(read_env_local_key QADBAK_PANEL_PORT 11000)"
MAIN_PANEL_HOST="$(read_env_local_key QADBAK_PUBLIC_HOST "")"
[[ -z "$MAIN_PANEL_HOST" ]] && MAIN_PANEL_HOST="$(read_env_local_key PANEL_HOST "")"
[[ -z "$MAIN_PANEL_HOST" ]] && MAIN_PANEL_HOST="$(hostname -f 2>/dev/null || hostname)"

is_valid_domain() {
  [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]
}

# curl exit codes must not abort the script (set -e + command substitution).
probe_http_code() {
  local url="$1"
  shift
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$@" "$url" 2>/dev/null)" || code="000"
  echo "${code:-000}"
}

UNIQUE=()

add_domain() {
  local d="${1,,}"
  [[ -z "$d" ]] && return 0
  is_valid_domain "$d" || return 0
  local existing
  for existing in "${UNIQUE[@]}"; do
    [[ "$existing" == "$d" ]] && return 0
  done
  UNIQUE+=("$d")
}

discover_from_registry() {
  local reg="$QADBAK_DIR/data/native-domains.json"
  [[ -f "$reg" ]] || return 0
  if command -v jq &>/dev/null; then
    while read -r d; do add_domain "$d"; done < <(jq -r '.[].name // empty' "$reg" 2>/dev/null || true)
  else
    while read -r d; do add_domain "$d"; done < <(
      node -e "
        const fs = require('fs');
        const rows = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        for (const r of rows || []) if (r && r.name) console.log(r.name);
      " "$reg" 2>/dev/null || true
    )
  fi
}

discover_from_home() {
  local hint domain
  for hint in /home/*/.qadbak-domain; do
    [[ -f "$hint" ]] || continue
    domain="$(tr -d '[:space:]' <"$hint")"
    add_domain "$domain"
  done
}

discover_from_nginx() {
  local f host
  for f in /etc/nginx/sites-enabled/qadbak-panel-*.conf; do
    [[ -f "$f" ]] || continue
    host="$(grep -m1 'server_name panel\.' "$f" 2>/dev/null | sed -E 's/.*server_name[[:space:]]+panel\.([^;[:space:]]+).*/\1/' || true)"
    add_domain "$host"
  done
}

for d in "${DOMAINS[@]}"; do add_domain "$d"; done
if [[ ${#UNIQUE[@]} -eq 0 ]]; then
  discover_from_registry
  discover_from_home
  discover_from_nginx
fi

echo "==> Qadbak panel access repair"
if [[ ${#UNIQUE[@]} -eq 0 ]]; then
  echo "    WARN: no customer domains found — pass: sudo bash $0 siccamanagement.nl" >&2
else
  echo "    Customer panel hosts: $(printf 'panel.%s ' "${UNIQUE[@]}")"
fi
echo "    Main panel host: $MAIN_PANEL_HOST"
echo "    Alt panel port: $PANEL_PORT"

echo ""
echo "==> 1) Application (pm2 + Next.js :3000)"
if sudo -u "$QADBAK_USER" pm2 list 2>/dev/null | grep -qE 'qadbak[[:space:]]'; then
  sudo -u "$QADBAK_USER" pm2 list 2>/dev/null | grep -E 'qadbak|name' || true
else
  echo "    WARN: pm2 process qadbak not listed" >&2
fi
HEALTH_SNIP="$(curl -sf "http://127.0.0.1:3000/api/health" 2>/dev/null | head -c 220 || true)"
if [[ -n "$HEALTH_SNIP" ]]; then
  printf '%s\n' "$HEALTH_SNIP"
  echo ""
  echo "    OK — /api/health"
else
  echo "    FAIL — Next.js not responding on :3000" >&2
  echo "    Try: sudo -u $QADBAK_USER bash -c 'cd $QADBAK_DIR && npm run build && bash scripts/pm2-restart-qadbak.sh'" >&2
fi

echo ""
echo "==> 2) panel.<domain> reachability (before repair)"
PRE_FAIL=0
for d in "${UNIQUE[@]}"; do
  host="panel.${d}"
  code_http="$(probe_http_code "http://127.0.0.1/login" -H "Host: $host")"
  echo "    $host HTTP → $code_http"
  if [[ ! "$code_http" =~ ^(200|301|302|307|308)$ ]]; then
    PRE_FAIL=1
  fi
done
if [[ -n "$MAIN_PANEL_HOST" ]]; then
  code_main="$(probe_http_code "https://127.0.0.1/login" -sk -H "Host: $MAIN_PANEL_HOST")"
  code_main_http="$(probe_http_code "http://127.0.0.1/login" -H "Host: $MAIN_PANEL_HOST")"
  echo "    $MAIN_PANEL_HOST HTTPS → $code_main  HTTP → $code_main_http"
fi
if [[ "$PRE_FAIL" -eq 1 ]]; then
  echo "    (some panel hosts unreachable before repair — continuing)"
fi

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo ""
  echo "Check-only mode — no changes applied."
  exit "$PRE_FAIL"
fi

echo ""
echo "==> 3) Main panel nginx vhost ($MAIN_PANEL_HOST)"
if [[ -f "$QADBAK_DIR/scripts/apply-hosting-nginx.sh" ]]; then
  QADBAK_PUBLIC_HOST="$MAIN_PANEL_HOST" PANEL_HOST="$MAIN_PANEL_HOST" \
    bash "$QADBAK_DIR/scripts/apply-hosting-nginx.sh" || \
    echo "    WARN: apply-hosting-nginx.sh failed" >&2
fi
if [[ -f "$QADBAK_DIR/scripts/dedupe-nginx-panel-vhosts.sh" && -n "$MAIN_PANEL_HOST" ]]; then
  bash "$QADBAK_DIR/scripts/dedupe-nginx-panel-vhosts.sh" "$MAIN_PANEL_HOST" || true
fi

echo ""
echo "==> 4) Client panel vhosts (panel.<domain> → :3000)"
VHOST_FAIL=0
for d in "${UNIQUE[@]}"; do
  echo "    apply-client-panel-vhost.sh $d"
  if ! bash "$QADBAK_DIR/scripts/apply-client-panel-vhost.sh" "$d"; then
    echo "    WARN: panel.$d vhost failed (see above)" >&2
    VHOST_FAIL=1
  fi
done
if [[ -f "$QADBAK_DIR/scripts/lib/sanitize-nginx-panel-vhosts.sh" ]]; then
  bash "$QADBAK_DIR/scripts/lib/sanitize-nginx-panel-vhosts.sh" 2>/dev/null || true
fi

echo ""
echo "==> 5) Alt panel port :$PANEL_PORT (not :3000 in browser)"
if ! bash "$QADBAK_DIR/scripts/fix-panel-nginx-port.sh" "$PANEL_PORT"; then
  echo "    WARN: fix-panel-nginx-port.sh failed" >&2
  VHOST_FAIL=1
fi

if [[ -f "$QADBAK_DIR/scripts/open-host-firewall-port.sh" ]]; then
  echo ""
  echo "==> 6) Host firewall (Cloudflare needs TCP 80 and 443)"
  bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 80 || true
  bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" 443 || true
  bash "$QADBAK_DIR/scripts/open-host-firewall-port.sh" "$PANEL_PORT" || true
fi

echo ""
echo "==> 7) Session cookies (HTTPS panels + Cloudflare)"
ENV_FILE="$QADBAK_DIR/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^QADBAK_COOKIE_SECURE=false' "$ENV_FILE" 2>/dev/null; then
    sed -i 's/^QADBAK_COOKIE_SECURE=false/QADBAK_COOKIE_SECURE=true/' "$ENV_FILE"
    echo "    Set QADBAK_COOKIE_SECURE=true (was false from :11000 bootstrap)"
  elif ! grep -q '^QADBAK_COOKIE_SECURE=' "$ENV_FILE" 2>/dev/null; then
    echo "QADBAK_COOKIE_SECURE=true" >>"$ENV_FILE"
    echo "    Set QADBAK_COOKIE_SECURE=true"
  fi
  chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE" 2>/dev/null || true
fi

echo ""
echo "==> 8) pm2 restart (load .env.local)"
sudo -u "$QADBAK_USER" bash -c "cd '$QADBAK_DIR' && bash scripts/pm2-restart-qadbak.sh" || true

echo ""
echo "==> 9) Verify (HTTP + HTTPS on origin)"
FAIL=0
for d in "${UNIQUE[@]}"; do
  host="panel.${d}"
  code_http="$(probe_http_code "http://127.0.0.1/login" -H "Host: $host")"
  code_https="$(probe_http_code "https://127.0.0.1/login" -sk -H "Host: $host")"
  echo "    $host HTTP → $code_http  HTTPS → $code_https"
  if [[ "$code_http" =~ ^(200|301|302|307|308)$ ]]; then
    echo "    OK — http://$host/login (Cloudflare Flexible uses this)"
  else
    echo "    FAIL — $host HTTP broken on origin" >&2
    FAIL=1
  fi
  if [[ -f "/etc/letsencrypt/live/${host}/fullchain.pem" ]]; then
    if [[ ! "$code_https" =~ ^(200|301|302|307|308)$ ]]; then
      echo "    WARN — $host HTTPS → $code_https (use Cloudflare SSL: Full)" >&2
    fi
  fi
done

code_alt="$(probe_http_code "http://127.0.0.1:${PANEL_PORT}/login")"
echo "    http://127.0.0.1:${PANEL_PORT}/login → $code_alt"

if [[ -n "$MAIN_PANEL_HOST" ]]; then
  code_main="$(probe_http_code "https://127.0.0.1/login" -sk -H "Host: $MAIN_PANEL_HOST")"
  echo "    https://$MAIN_PANEL_HOST/login (origin) → $code_main"
fi

echo ""
if [[ "$FAIL" -ne 0 || "$VHOST_FAIL" -ne 0 ]]; then
  echo "Panel repair incomplete. Check:" >&2
  echo "  sudo nginx -t" >&2
  echo "  sudo tail -40 /var/log/nginx/error.log" >&2
  echo "  sudo -u $QADBAK_USER pm2 logs qadbak --lines 40" >&2
  echo "  Cloudflare SSL → Flexible if origin HTTPS fails" >&2
  exit 1
fi

ORIGIN_IP="$(curl -4 -fsS --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "OK — panel access repaired."
echo "  Customer: https://panel.<your-domain>/login"
echo "  Main:     https://${MAIN_PANEL_HOST}/login"
echo "  Direct:   http://${ORIGIN_IP}:${PANEL_PORT}/login"
echo ""
echo "Cloudflare (panel.siccamanagement.nl etc.):"
echo "  1) DNS A-record: panel → ${ORIGIN_IP} (proxied orange cloud OK)"
echo "  2) SSL/TLS mode: Flexible (HTTP to origin) or Full (with Let's Encrypt on panel.*)"
echo "  3) Do NOT use Full (strict) unless origin cert is valid for panel.<domain>"
