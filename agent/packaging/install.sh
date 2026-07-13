#!/usr/bin/env bash
# Hardened Qadbak Agent install (Debian 12 / Ubuntu 22.04 / 24.04).
set -euo pipefail

AGENT_PORT="${QADBAK_AGENT_PORT:-9443}"
DATA_DIR="${QADBAK_AGENT_DATA_DIR:-/var/lib/qadbak-agent}"
CONFIG_DIR="${QADBAK_AGENT_CONFIG_DIR:-/etc/qadbak-agent}"
INSTALL_DIR="${QADBAK_AGENT_INSTALL_DIR:-/usr/lib/qadbak-agent}"
UNIT_NAME="qadbak-agent.service"
AGENT_USER="qadbak-agent"
LISTEN_MODE="${QADBAK_AGENT_LISTEN_MODE:-auto}"
MANIFEST="${2:-}"
AGENT_LISTEN=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=resolve-listen.sh
source "${SCRIPT_DIR}/resolve-listen.sh"

log() { printf '[qadbak-agent] %s\n' "$*"; }
die() { log "ERROR: $*"; exit 1; }

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)."
}

check_os() {
  [[ -f /etc/os-release ]] || die "Missing /etc/os-release"
  # shellcheck disable=SC1091
  source /etc/os-release
  case "${ID:-}" in
    debian) [[ "${VERSION_ID:-}" == "12" ]] || die "Debian 12 required (beta)" ;;
    ubuntu) [[ "${VERSION_ID:-}" == "22.04" || "${VERSION_ID:-}" == "24.04" ]] || die "Ubuntu 22.04/24.04 required (beta)" ;;
    *) die "Unsupported OS ${ID:-unknown}" ;;
  esac
}

verify_checksum() {
  local bin="$1"
  [[ -n "$MANIFEST" && -f "$MANIFEST" ]] || return 0
  command -v python3 >/dev/null 2>&1 || return 0
  local arch expected actual
  arch="$(uname -m)"
  case "$arch" in
    x86_64) arch="linux-amd64" ;;
    aarch64) arch="linux-arm64" ;;
    *) return 0 ;;
  esac
  expected="$(python3 - "$MANIFEST" "$arch" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
print(data.get("binaries", {}).get(sys.argv[2], {}).get("sha256", ""))
PY
)"
  [[ -n "$expected" ]] || return 0
  actual="$(sha256sum "$bin" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || die "Checksum mismatch (expected $expected, got $actual)"
  log "Checksum verified"
}

ensure_user() {
  if ! id "$AGENT_USER" &>/dev/null; then
    useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$AGENT_USER"
    log "Created user $AGENT_USER"
  fi
	usermod -aG adm "$AGENT_USER" 2>/dev/null || true
	if getent group systemd-journal &>/dev/null; then
		usermod -aG systemd-journal "$AGENT_USER" 2>/dev/null || true
	fi
  if getent group docker &>/dev/null; then
    usermod -aG docker "$AGENT_USER" 2>/dev/null || true
  fi
}

install_binary() {
  local src="${1:-}"
  [[ -n "$src" && -f "$src" ]] || die "Agent binary path required as first argument"
  verify_checksum "$src"
  install -d -m 0750 "$INSTALL_DIR" "$DATA_DIR" "$CONFIG_DIR"
  install -m 0750 -o root -g "$AGENT_USER" "$src" "${INSTALL_DIR}/qadbak-agent"
  chown root:"$AGENT_USER" "$INSTALL_DIR" "$CONFIG_DIR"
  chmod 0750 "$INSTALL_DIR" "$CONFIG_DIR"
  ln -sf "${INSTALL_DIR}/qadbak-agent" /usr/local/bin/qadbak-agent
  if ! runuser -u "$AGENT_USER" -- test -x "${INSTALL_DIR}/qadbak-agent"; then
    die "Agent user cannot execute ${INSTALL_DIR}/qadbak-agent (directory ownership must be root:${AGENT_USER} 0750)"
  fi
  log "Installed binary to ${INSTALL_DIR}/qadbak-agent"
}

ensure_jwt_secret() {
  local secret_file="${CONFIG_DIR}/jwt.secret"
  if [[ ! -f "$secret_file" ]]; then
    openssl rand -hex 32 >"$secret_file"
    chmod 640 "$secret_file"
    chown root:"$AGENT_USER" "$secret_file"
    log "Generated JWT secret"
  fi
}

write_sudoers() {
  local dropin="/etc/sudoers.d/qadbak-agent"
  cat >"$dropin" <<EOF
# Managed by Qadbak Agent installer — do not edit manually.
Defaults:qadbak-agent !requiretty
qadbak-agent ALL=(root) NOPASSWD: ${INSTALL_DIR}/qadbak-agent priv *
EOF
  chmod 440 "$dropin"
  visudo -cf "$dropin" >/dev/null 2>&1 || die "Invalid sudoers drop-in"
  log "Installed sudoers drop-in"
}

write_unit() {
  AGENT_LISTEN="$(resolve_agent_listen "$AGENT_PORT" "$LISTEN_MODE")" || die "Could not resolve listen address (mode=$LISTEN_MODE)"
  write_agent_env "$AGENT_LISTEN" "$LISTEN_MODE" "$CONFIG_DIR"
  apply_agent_firewall "$LISTEN_MODE" "$AGENT_PORT"
  log "Agent will listen on https://${AGENT_LISTEN} (mode=${LISTEN_MODE})"
  cat >"/etc/systemd/system/${UNIT_NAME}" <<EOF
[Unit]
Description=Qadbak Linux Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${AGENT_USER}
Group=${AGENT_USER}
Environment=QADBAK_AGENT_DATA_DIR=${DATA_DIR}
Environment=QADBAK_AGENT_LISTEN=${AGENT_LISTEN}
Environment=QADBAK_AGENT_LISTEN_MODE=${LISTEN_MODE}
Environment=QADBAK_AGENT_BINARY=${INSTALL_DIR}/qadbak-agent
EnvironmentFile=-${CONFIG_DIR}/agent.env
ExecStart=${INSTALL_DIR}/qadbak-agent -listen ${AGENT_LISTEN} -data-dir ${DATA_DIR}
Restart=on-failure
RestartSec=3
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${CONFIG_DIR} /usr/local/hestia /tmp
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF
  chown -R "${AGENT_USER}:${AGENT_USER}" "$DATA_DIR"
  chmod 750 "$DATA_DIR"
  systemctl stop "${UNIT_NAME}" 2>/dev/null || true
  if command -v ss >/dev/null 2>&1; then
    if ss -tlnH 2>/dev/null | awk -v p=":$AGENT_PORT" '$4 ~ p"$" {found=1} END{exit !found}'; then
      die "Port ${AGENT_PORT} already in use (see: ss -tlnp | grep ${AGENT_PORT})"
    fi
  fi
  systemctl daemon-reload
  systemctl enable "${UNIT_NAME}"
  systemctl restart "${UNIT_NAME}"
  log "systemd unit enabled (non-root)"
}

pairing_connect_host() {
  local host="${AGENT_LISTEN%%:*}"
  if [[ "$host" == "0.0.0.0" ]]; then
    host="127.0.0.1"
  fi
  printf '%s' "$host"
}

issue_pairing() {
  local connect host resp attempt
  connect="$(pairing_connect_host)"
  local tmp
  tmp="$(mktemp)"
  for attempt in $(seq 1 45); do
    if systemctl is-active --quiet "${UNIT_NAME}"; then
      for host in 127.0.0.1 "$connect"; do
        [[ -z "$host" || "$host" == "0.0.0.0" ]] && continue
        if curl -4sk --max-time 8 -X POST "https://${host}:${AGENT_PORT}/api/v1/pairing/init" -o "$tmp" 2>/dev/null \
          && grep -q pairingToken "$tmp" 2>/dev/null; then
          break 2
        fi
      done
    fi
    sleep 1
  done
  if ! grep -q pairingToken "$tmp" 2>/dev/null; then
    rm -f "$tmp"
    systemctl status "${UNIT_NAME}" --no-pager >&2 || true
    journalctl -u "${UNIT_NAME}" -n 25 --no-pager >&2 || true
    die "Agent not responding on https://${connect} (port ${AGENT_PORT})"
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$tmp" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
print(data.get("pairingToken", ""))
print(data.get("tlsFingerprintSha256", ""))
PY
  else
    grep -o '"pairingToken":"[^"]*"' "$tmp" | head -1 | cut -d'"' -f4
    grep -o '"tlsFingerprintSha256":"[^"]*"' "$tmp" | head -1 | cut -d'"' -f4
  fi
  rm -f "$tmp"
}

main() {
  require_root
  check_os
  ensure_user
  install_binary "${1:-}"
  ensure_jwt_secret
  write_sudoers
  write_unit
  printf 'agent_listen_host:%s\n' "${AGENT_LISTEN%%:*}"
  log "Pairing credentials (use within 10 minutes):"
  issue_pairing
}

main "$@"
