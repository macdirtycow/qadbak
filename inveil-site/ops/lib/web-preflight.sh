#!/usr/bin/env bash
# Shared checks before certbot / public HTTP(S) on a VPS.
set -euo pipefail

web_preflight_public_ipv4() {
  curl -4 -sf --max-time 8 ifconfig.me 2>/dev/null \
    || curl -4 -sf --max-time 8 https://api.ipify.org 2>/dev/null \
    || true
}

web_preflight_open_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    echo "==> ufw: allow 80/tcp and 443/tcp"
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi
}

web_preflight_check_dns() {
  local host="$1"
  local public_ip="${2:-}"
  [[ -n "$host" && -n "$public_ip" ]] || return 0
  local dns_ip
  dns_ip="$(dig +short A "$host" 2>/dev/null | grep -E '^[0-9.]+$' | tail -1 || true)"
  if [[ -z "$dns_ip" ]]; then
    echo "WARN: no A record for $host yet" >&2
  elif [[ "$dns_ip" != "$public_ip" ]]; then
    echo "WARN: $host → $dns_ip but this server is $public_ip" >&2
  else
    echo "DNS OK — $host → $public_ip"
  fi
}

web_preflight_ensure_nginx() {
  command -v nginx >/dev/null || { echo "Install nginx first" >&2; return 1; }
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl start nginx >/dev/null 2>&1 || true
}

web_preflight_issue_cert() {
  local host="$1"
  local email="${2:-admin@${host#*.}}"
  local webroot="${3:-/var/www/acme}"
  local cert="/etc/letsencrypt/live/${host}/fullchain.pem"

  [[ -f "$cert" ]] && return 0
  command -v certbot >/dev/null || {
    echo "WARN: certbot not installed — skip TLS for $host" >&2
    return 1
  }

  mkdir -p "$webroot"
  web_preflight_open_firewall
  web_preflight_ensure_nginx

  local public_ip
  public_ip="$(web_preflight_public_ipv4)"
  [[ -n "$public_ip" ]] && echo "This server public IPv4: $public_ip"
  web_preflight_check_dns "$host" "$public_ip"

  echo "==> certbot for $host"
  if certbot certonly --webroot -w "$webroot" -d "$host" \
    --non-interactive --agree-tos -m "$email" --keep-until-expiring; then
    return 0
  fi
  if certbot certonly --nginx -d "$host" \
    --non-interactive --agree-tos -m "$email" --keep-until-expiring; then
    return 0
  fi

  echo "WARN: certbot failed for $host" >&2
  echo "  • Cloudflare: DNS only (grey cloud) for $host" >&2
  echo "  • Contabo panel: allow inbound TCP 80 and 443 on this VPS" >&2
  echo "  • Then: certbot certonly --webroot -w $webroot -d $host" >&2
  return 1
}
