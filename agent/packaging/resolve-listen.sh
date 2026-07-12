#!/usr/bin/env bash
# Resolve agent HTTPS listen address and optional firewall rules.
# Sourced by install scripts — do not execute directly.

resolve_agent_listen() {
  local port="${1:-9443}"
  local mode="${2:-${QADBAK_AGENT_LISTEN_MODE:-}}"

  if [[ -n "${QADBAK_AGENT_LISTEN:-}" ]]; then
    printf '%s\n' "$QADBAK_AGENT_LISTEN"
    return 0
  fi

  case "$mode" in
    lan)
      printf '0.0.0.0:%s\n' "$port"
      return 0
      ;;
    local|localhost)
      printf '127.0.0.1:%s\n' "$port"
      return 0
      ;;
    tailscale)
      _qadbak_tailscale_ipv4 || return 1
      printf '%s:%s\n' "$_QADBAK_TS_IP" "$port"
      return 0
      ;;
    auto|"")
      if _qadbak_tailscale_ipv4; then
        printf '%s:%s\n' "$_QADBAK_TS_IP" "$port"
        return 0
      fi
      printf '127.0.0.1:%s\n' "$port"
      return 0
      ;;
    *)
      printf '127.0.0.1:%s\n' "$port"
      return 0
      ;;
  esac
}

# Prints host portion of resolved listen (no port).
resolve_agent_listen_host() {
  local listen
  listen="$(resolve_agent_listen "$@")" || return 1
  printf '%s\n' "${listen%%:*}"
}

_qadbak_tailscale_ipv4() {
  _QADBAK_TS_IP=""
  if command -v tailscale >/dev/null 2>&1; then
    _QADBAK_TS_IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
    [[ -n "$_QADBAK_TS_IP" ]] && return 0
  fi
  if [[ -d /sys/class/net/tailscale0 ]]; then
    _QADBAK_TS_IP="$(ip -4 -o addr show dev tailscale0 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)"
    [[ -n "$_QADBAK_TS_IP" ]] && return 0
  fi
  return 1
}

apply_agent_firewall() {
  local mode="${1:-}"
  local port="${2:-9443}"
  command -v ufw >/dev/null 2>&1 || return 0
  ufw status >/dev/null 2>&1 || return 0
  case "$mode" in
    tailscale|auto)
      ufw allow in on tailscale0 to any port "$port" proto tcp comment 'qadbak-agent' >/dev/null 2>&1 || true
      ;;
    lan)
      ufw allow "$port"/tcp comment 'qadbak-agent (review: restrict source IPs)' >/dev/null 2>&1 || true
      ;;
  esac
}

write_agent_env() {
  local listen="$1"
  local mode="$2"
  local config_dir="${3:-/etc/qadbak-agent}"
  install -d -m 0750 "$config_dir"
  cat >"${config_dir}/agent.env" <<EOF
# Managed by Qadbak agent installer — do not edit unless you know the exposure trade-offs.
QADBAK_AGENT_LISTEN=${listen}
QADBAK_AGENT_LISTEN_MODE=${mode}
EOF
  chmod 640 "${config_dir}/agent.env"
}
