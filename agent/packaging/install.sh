#!/usr/bin/env bash
# Idempotent Qadbak Agent install (Debian 12 / Ubuntu 22.04 / 24.04).
set -euo pipefail

AGENT_PORT="${QADBAK_AGENT_PORT:-9443}"
DATA_DIR="${QADBAK_AGENT_DATA_DIR:-/var/lib/qadbak-agent}"
BIN_DIR="${QADBAK_AGENT_BIN_DIR:-/usr/local/bin}"
UNIT_NAME="qadbak-agent.service"
LISTEN="0.0.0.0:${AGENT_PORT}"

log() { printf '[qadbak-agent] %s\n' "$*"; }
die() { log "ERROR: $*"; exit 1; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Run as root (sudo)."
  fi
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

install_binary() {
  local src="${1:-}"
  [[ -n "$src" && -f "$src" ]] || die "Agent binary path required as first argument"
  install -d -m 0750 "$DATA_DIR"
  install -m 0755 "$src" "${BIN_DIR}/qadbak-agent"
  log "Installed binary to ${BIN_DIR}/qadbak-agent"
}

write_unit() {
  cat >"/etc/systemd/system/${UNIT_NAME}" <<EOF
[Unit]
Description=Qadbak Linux Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=QADBAK_AGENT_DATA_DIR=${DATA_DIR}
Environment=QADBAK_AGENT_LISTEN=${LISTEN}
ExecStart=${BIN_DIR}/qadbak-agent -listen ${LISTEN} -data-dir ${DATA_DIR}
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "${UNIT_NAME}"
  log "systemd unit enabled"
}

issue_pairing() {
  local tmp
  tmp="$(mktemp)"
  curl -sk -X POST "https://127.0.0.1:${AGENT_PORT}/api/v1/pairing/init" -o "$tmp" || die "Agent not responding on port ${AGENT_PORT}"
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
  install_binary "${1:-}"
  write_unit
  sleep 1
  log "Pairing credentials (use within 10 minutes):"
  issue_pairing
}

main "$@"
