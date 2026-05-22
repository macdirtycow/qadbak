#!/usr/bin/env bash
# Point WEBMIN_UI_URL at the panel origin /embed/webmin/ so login links work in iframes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
PANEL_PORT="${QADBAK_PANEL_PORT:-11000}"

is_bare_ip() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

detect_panel_url() {
  local ip fqdn scheme url host_for_port
  ip="$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || true)"
  fqdn="$(hostname -f 2>/dev/null || hostname)"
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1091
    source <(grep -E '^(QADBAK_PANEL_URL|QADBAK_PUBLIC_HOST)=' "$ENV_FILE" 2>/dev/null | sed 's/^/export /') || true
  fi
  host_for_port="${QADBAK_PUBLIC_HOST:-}"
  if [[ -z "$host_for_port" ]] || is_bare_ip "$host_for_port"; then
    host_for_port="$fqdn"
  fi
  if [[ -n "${QADBAK_PANEL_URL:-}" ]]; then
    url="${QADBAK_PANEL_URL%/}"
    if [[ "$url" =~ ^https?://([0-9.]+):([0-9]+)$ ]] && [[ -n "$host_for_port" ]] && ! is_bare_ip "$host_for_port"; then
      echo "http://${host_for_port}:${BASH_REMATCH[2]}"
      return
    fi
    echo "$url"
    return
  fi
  if ss -tln 2>/dev/null | grep -q ":${PANEL_PORT} "; then
    scheme="http"
    if [[ -n "${QADBAK_PUBLIC_HOST:-}" && "${QADBAK_PUBLIC_HOST}" != "$ip" ]]; then
      echo "${scheme}://${QADBAK_PUBLIC_HOST}:${PANEL_PORT}"
      return
    fi
    if [[ -n "$fqdn" && "$fqdn" != "$ip" ]]; then
      echo "${scheme}://${fqdn}:${PANEL_PORT}"
      return
    fi
    if [[ -n "$ip" ]]; then
      echo "${scheme}://${ip}:${PANEL_PORT}"
      return
    fi
  fi
  if [[ -n "${QADBAK_PUBLIC_HOST:-}" ]]; then
    echo "https://${QADBAK_PUBLIC_HOST}"
    return
  fi
  if [[ -n "$fqdn" ]]; then
    echo "https://${fqdn}"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No $ENV_FILE — skip env sync" >&2
  exit 0
fi

PANEL_URL="$(detect_panel_url)"
if [[ -z "$PANEL_URL" ]]; then
  echo "Could not detect panel URL — set QADBAK_PANEL_URL in .env.local" >&2
  exit 0
fi

EMBED_BASE="${PANEL_URL}/embed/webmin"

set_env_key() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

echo "==> .env.local: WEBMIN_UI_URL → $EMBED_BASE"
set_env_key "WEBMIN_UI_URL" "$EMBED_BASE" "$ENV_FILE"
set_env_key "VIRTUALMIN_UI_URL" "$EMBED_BASE" "$ENV_FILE"
set_env_key "QADBAK_WEBMIN_EMBED_BASE" "$EMBED_BASE" "$ENV_FILE"
set_env_key "QADBAK_PANEL_URL" "$PANEL_URL" "$ENV_FILE"
