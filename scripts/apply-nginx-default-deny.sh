#!/usr/bin/env bash
# Neutral default_server vhost so nginx never falls through to an unrelated
# vhost (e.g. license-server, panel, customer site) for unknown hostnames.
#
# Returns HTTP 444 (drop connection) on both port 80 and 443. The HTTPS
# listener uses a self-signed snake-oil cert so SSL handshakes complete
# cleanly before nginx drops the connection — unknown hosts get a clean
# close, not ERR_SSL_PROTOCOL_ERROR.
#
# Idempotent. Refuses to enable itself if another vhost already claims
# default_server on the same port — prints the exact override command
# instead of guessing which vhost "should" be the default.
#
# Usage:
#   sudo bash scripts/apply-nginx-default-deny.sh           # apply
#   sudo bash scripts/apply-nginx-default-deny.sh --check   # diagnose only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"

VHOST_NAME="qadbak-default-deny"
VHOST_AVAIL="/etc/nginx/sites-available/${VHOST_NAME}.conf"
VHOST_ENABLED="/etc/nginx/sites-enabled/${VHOST_NAME}.conf"
SSL_CRT="/etc/ssl/certs/qadbak-default-deny.crt"
SSL_KEY="/etc/ssl/private/qadbak-default-deny.key"

CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    -h|--help)
      sed -n '1,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: sudo bash $0 [--check]" >&2
      exit 2
      ;;
  esac
done

# default_server scanner — works even when nginx isn't installed yet.
# Lists every sites-enabled vhost that claims default_server on a given
# port (80 or 443), skipping our own deny vhost.
list_default_server_files() {
  local want_port="$1"
  local dir="/etc/nginx/sites-enabled"
  [[ -d "$dir" ]] || return 0
  local f
  for f in "$dir"/*; do
    [[ -e "$f" ]] || continue
    [[ "$(basename "$f")" == "${VHOST_NAME}.conf" ]] && continue
    # Match: listen [::]:443 ssl default_server;  / listen 80 default_server;
    # We accept any listen line that mentions both the port and default_server.
    awk -v port="$want_port" '
      /^[[:space:]]*listen[[:space:]]/ {
        if ($0 ~ "default_server" && $0 ~ ("[^0-9]" port "([^0-9]|$)")) {
          print FILENAME
          exit 0
        }
      }
    ' "$f" 2>/dev/null
  done | sort -u
}

print_check_report() {
  echo "==> nginx default_server occupants"
  local port files
  for port in 80 443; do
    files="$(list_default_server_files "$port" || true)"
    if [[ -z "$files" ]]; then
      echo "    port $port: (none)"
    else
      echo "    port $port:"
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        echo "      $f"
      done <<<"$files"
    fi
  done
  if [[ -L "$VHOST_ENABLED" ]] || [[ -f "$VHOST_ENABLED" ]]; then
    echo "    qadbak-default-deny: enabled ($VHOST_ENABLED)"
  else
    echo "    qadbak-default-deny: not enabled"
  fi
}

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  print_check_report
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/apply-nginx-default-deny.sh" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx not installed — skipping default-deny vhost." >&2
  exit 0
fi
if [[ ! -d /etc/nginx/sites-available ]] || [[ ! -d /etc/nginx/sites-enabled ]]; then
  echo "nginx sites-available/sites-enabled missing — non-Debian layout, skipping." >&2
  exit 0
fi

echo "==> Snake-oil cert for default-deny vhost"
if [[ -s "$SSL_CRT" && -s "$SSL_KEY" ]]; then
  echo "    Reusing $SSL_CRT"
else
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl not installed — cannot generate snake-oil cert. Install openssl and re-run." >&2
    exit 1
  fi
  install -d -m 0755 /etc/ssl/certs
  install -d -m 0710 /etc/ssl/private
  umask 077
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$SSL_KEY" -out "$SSL_CRT" \
    -subj "/CN=qadbak-default-deny" >/dev/null 2>&1
  chmod 0644 "$SSL_CRT"
  chmod 0640 "$SSL_KEY"
  echo "    Wrote $SSL_CRT (self-signed, 10y)"
fi

echo "==> Writing $VHOST_AVAIL"
cat >"$VHOST_AVAIL" <<EOF
# Managed by scripts/apply-nginx-default-deny.sh — do not edit by hand.
# Catches every Host header that no other vhost matches and drops the
# connection (HTTP 444). Prevents unknown hostnames from leaking through
# to the panel, license-server, or any customer vhost that happens to
# have default_server set.

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name _;

    ssl_certificate     ${SSL_CRT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;

    return 444;
}
EOF

CONFLICTS=()
for port in 80 443; do
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    CONFLICTS+=("${port}|${f}")
  done < <(list_default_server_files "$port" || true)
done

if [[ ${#CONFLICTS[@]} -gt 0 ]]; then
  echo ""
  echo "WARN: another vhost already claims default_server — refusing to enable" >&2
  echo "      qadbak-default-deny until the conflict is resolved manually." >&2
  echo "" >&2
  declare -A SEEN_FILES=()
  for entry in "${CONFLICTS[@]}"; do
    port="${entry%%|*}"
    file="${entry#*|}"
    echo "    port ${port}: ${file}" >&2
    SEEN_FILES["$file"]=1
  done
  echo "" >&2
  echo "      To hand the default over to qadbak-default-deny, strip" >&2
  echo "      'default_server' from those vhosts and re-run this script:" >&2
  echo "" >&2
  for f in "${!SEEN_FILES[@]}"; do
    echo "        sudo sed -i 's/ default_server//g' '${f}'" >&2
  done
  echo "        sudo nginx -t && sudo systemctl reload nginx" >&2
  echo "        sudo bash $QADBAK_DIR/scripts/apply-nginx-default-deny.sh" >&2
  echo "" >&2
  echo "      Vhost was written to $VHOST_AVAIL but NOT enabled." >&2
  exit 3
fi

echo "==> Enabling $VHOST_ENABLED"
ln -sf "$VHOST_AVAIL" "$VHOST_ENABLED"

if ! nginx -t; then
  echo "nginx -t failed — reverting." >&2
  rm -f "$VHOST_ENABLED"
  nginx -t || true
  exit 1
fi

systemctl reload nginx
echo ""
echo "Done. Unknown hostnames now get HTTP 444 on ports 80/443."
echo "  Verify:  curl -skI -H 'Host: nonexistent.invalid' https://127.0.0.1/   # expect connection drop"
echo "  Diagnose: sudo bash $QADBAK_DIR/scripts/apply-nginx-default-deny.sh --check"
