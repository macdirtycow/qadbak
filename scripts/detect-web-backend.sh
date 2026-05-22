#!/usr/bin/env bash
# Find where VirtualMin/Apache answers HTTP for hosted domains (for nginx proxy_pass).
set -euo pipefail

DOMAIN="${DETECT_DOMAIN:-}"
if [[ -z "$DOMAIN" ]] && command -v virtualmin &>/dev/null; then
  DOMAIN="$(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d' | head -1)"
fi
DOMAIN="${DOMAIN:-localhost}"
DEFAULT="127.0.0.1:8080"
# Panel / Webmin / terminal — never use as PHP site backend
SKIP_RE='^(3000|3001|10000|20000)$'

probe() {
  local base="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 4 \
    -H "Host: $DOMAIN" "${base}/" 2>/dev/null || echo 000)"
  [[ "$code" =~ ^[0-9]+$ ]] && (( code >= 200 && code < 500 ))
}

should_skip_port() {
  [[ "$1" =~ $SKIP_RE ]]
}

collect_ports() {
  local ports=()
  ports+=(8080)
  if [[ -f /etc/apache2/ports.conf ]]; then
    while read -r p; do
      [[ -n "$p" && "$p" != "80" && "$p" != "443" ]] && ! should_skip_port "$p" && ports+=("$p")
    done < <(awk '/^[[:space:]]*Listen[[:space:]]/ {print $2}' /etc/apache2/ports.conf | sed 's/^127\.0\.0\.1://')
  fi
  if command -v ss &>/dev/null; then
    while read -r p; do
      should_skip_port "$p" && continue
      ports+=("$p")
    done < <(ss -ltn 2>/dev/null | awk '/127\.0\.0\.1:/ {split($4,a,":"); print a[length(a)]}' | sort -u)
  fi
  for p in 8180 81 8000; do
    ports+=("$p")
  done
  printf '%s\n' "${ports[@]}" | sort -u -n
}

while read -r port; do
  [[ -z "$port" ]] && continue
  [[ "$port" == "80" || "$port" == "443" ]] && continue
  if probe "http://127.0.0.1:${port}"; then
    echo "127.0.0.1:${port}"
    exit 0
  fi
done < <(collect_ports)

echo "$DEFAULT" >&2
echo "$DEFAULT"
