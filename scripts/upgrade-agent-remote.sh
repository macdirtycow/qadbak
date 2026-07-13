#!/usr/bin/env bash
# Upload bundled agent binary from this repo to a remote Linux server and install it.
# Usage: ./scripts/upgrade-agent-remote.sh user@host [linux-amd64|linux-arm64]
#
# On HestiaCP VPS hosts, web users (e.g. macdirtycow) are often SFTP-only — use the
# Hestia admin SSH user instead (usually admin@host), or run the printed install
# command in your provider console / Hestia web terminal as root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
ARCH_KEY="${2:-linux-amd64}"
REMOTE_DIR="qadbak-agent-upgrade"

if [[ -z "${TARGET}" ]]; then
  echo "Usage: $0 user@host [linux-amd64|linux-arm64]" >&2
  echo "Example: $0 admin@173.212.250.158 linux-amd64" >&2
  exit 1
fi

case "${ARCH_KEY}" in
  linux-amd64) BIN_NAME="qadbak-agent-linux-amd64" ;;
  linux-arm64) BIN_NAME="qadbak-agent-linux-arm64" ;;
  *) echo "Unknown arch key: ${ARCH_KEY}" >&2; exit 1 ;;
esac

BIN="${ROOT}/ios/Qadbak/Resources/Agent/${BIN_NAME}"
MANIFEST="${ROOT}/ios/Qadbak/Resources/Agent/manifest.json"
INSTALLER="${ROOT}/agent/packaging/install.sh"

[[ -f "${BIN}" ]] || { echo "Missing ${BIN} — run: bash scripts/copy-agent-to-ios.sh" >&2; exit 1; }
[[ -f "${INSTALLER}" ]] || { echo "Missing ${INSTALLER}" >&2; exit 1; }

ssh_shell_ok() {
  local err
  err="$(ssh -o ConnectTimeout=15 "${TARGET}" "echo qadbak-ssh-ok" 2>&1)" || true
  if [[ "${err}" == *"qadbak-ssh-ok"* ]]; then
    return 0
  fi
  if [[ "${err}" == *"sftp connections only"* ]] || [[ "${err}" == *"This service allows sftp"* ]]; then
    echo "note: ${TARGET} is SFTP-only (no remote shell)." >&2
    return 1
  fi
  echo "${err}" >&2
  return 1
}

upload_via_ssh() {
  echo "Preparing ~/${REMOTE_DIR} on ${TARGET}..."
  ssh "${TARGET}" "rm -rf ~/${REMOTE_DIR} && mkdir -p ~/${REMOTE_DIR}"
  echo "Uploading ${BIN_NAME}..."
  scp "${BIN}" "${MANIFEST}" "${INSTALLER}" "${TARGET}:${REMOTE_DIR}/"
}

upload_via_sftp() {
  echo "Uploading ${BIN_NAME} via SFTP to ~/${REMOTE_DIR}/ ..."
  sftp "${TARGET}" <<EOF
-mkdir ${REMOTE_DIR}
cd ${REMOTE_DIR}
put ${BIN}
put ${MANIFEST}
put ${INSTALLER}
EOF
}

install_via_ssh() {
  echo "Installing with sudo (enter sudo password if prompted)..."
  ssh -t "${TARGET}" "sudo bash ~/${REMOTE_DIR}/install.sh ~/${REMOTE_DIR}/${BIN_NAME} ~/${REMOTE_DIR}/manifest.json && rm -rf ~/${REMOTE_DIR}"
}

print_manual_install() {
  local user host
  user="${TARGET%@*}"
  host="${TARGET#*@}"
  cat <<EOF

Could not run install over SSH for ${TARGET}.

Files should be in ~/${REMOTE_DIR}/ on the server (SFTP upload).

Option A — use the Hestia admin SSH user (full shell), from your Mac:
  ./scripts/upgrade-agent-remote.sh admin@${host} ${ARCH_KEY}

Option B — run on the server as root (provider console or Hestia Terminal):
  bash /home/${user}/${REMOTE_DIR}/install.sh \\
    /home/${user}/${REMOTE_DIR}/${BIN_NAME} \\
    /home/${user}/${REMOTE_DIR}/manifest.json

Option C — upgrade from the Qadbak iOS app (Server → Control → Upgrade agent)
  when the agent already supports HTTPS self-upgrade.

Verify after install:
  /usr/lib/qadbak-agent/qadbak-agent -version

EOF
}

if ssh_shell_ok; then
  upload_via_ssh
  install_via_ssh
  echo "Agent upgraded on ${TARGET}."
else
  upload_via_sftp
  print_manual_install
  exit 1
fi

echo "Verify: ssh <shell-user>@${TARGET#*@} '/usr/lib/qadbak-agent/qadbak-agent -version'"
