#!/usr/bin/env bash
# Print the Apache (or httpd) address nginx should proxy hosted domains to.
# Default VirtualMin + nginx front: Apache listens on 127.0.0.1:8080.
set -euo pipefail

DEFAULT="127.0.0.1:8080"

pick_listen() {
  local ports=("$@")
  local p
  for p in "${ports[@]}"; do
    [[ -z "$p" ]] && continue
    [[ "$p" == "80" || "$p" == "443" ]] && continue
    echo "127.0.0.1:$p"
    return 0
  done
  return 1
}

if [[ -f /etc/apache2/ports.conf ]]; then
  mapfile -t LISTENS < <(awk '/^[[:space:]]*Listen[[:space:]]/ {print $2}' /etc/apache2/ports.conf | sed 's/^127\.0\.0\.1://')
  if pick_listen "${LISTENS[@]}"; then
    exit 0
  fi
fi

if [[ -f /etc/httpd/conf/httpd.conf ]]; then
  mapfile -t LISTENS < <(awk '/^[[:space:]]*Listen[[:space:]]/ {print $2}' /etc/httpd/conf/httpd.conf | sed 's/^127\.0\.0\.1://')
  if pick_listen "${LISTENS[@]}"; then
    exit 0
  fi
fi

# ss fallback: apache bound to non-80 loopback
if command -v ss &>/dev/null; then
  PORT="$(ss -ltn 2>/dev/null | awk '/127\.0\.0\.1:(8080|8180|81|8000)/ {split($4,a,":"); print a[length(a)]; exit}')"
  if [[ -n "$PORT" ]]; then
    echo "127.0.0.1:$PORT"
    exit 0
  fi
fi

echo "$DEFAULT"
