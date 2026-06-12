#!/usr/bin/env bash
# Disable Apache vhosts whose DocumentRoot no longer exists (e.g. after domain-delete).
# Fixes apache2ctl warnings like: DocumentRoot [/home/maplesign/public_html] does not exist
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/lib/prune-apache-vhosts.sh" >&2
  exit 1
fi

command -v apache2ctl >/dev/null 2>&1 || {
  echo "SKIP — apache2 not installed"
  exit 0
}

shopt -s nullglob
changed=0

prune_conf() {
  local conf="$1"
  [[ -f "$conf" ]] || return 0
  local docroot site
  docroot="$(grep -E '^[[:space:]]*DocumentRoot[[:space:]]+' "$conf" 2>/dev/null | head -1 | awk '{print $2}' || true)"
  [[ -n "$docroot" ]] || return 0
  if [[ -d "$docroot" ]]; then
    return 0
  fi
  site="$(basename "$conf")"
  echo "    REMOVE stale Apache vhost $site (missing $docroot)"
  a2dissite "$site" 2>/dev/null || true
  rm -f "$conf" "/etc/apache2/sites-enabled/$site" 2>/dev/null || true
  changed=1
}

for conf in /etc/apache2/sites-available/*.conf; do
  prune_conf "$conf"
done

if [[ "$changed" -eq 1 ]]; then
  echo "==> apache2ctl configtest"
  apache2ctl configtest 2>&1 | sed 's/^/    /' || true
  systemctl reload apache2 2>/dev/null || service apache2 reload 2>/dev/null || true
  echo "OK — pruned stale Apache vhosts"
else
  echo "OK — no stale Apache vhosts"
fi
