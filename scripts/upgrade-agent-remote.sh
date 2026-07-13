#!/usr/bin/env bash
# Upload bundled agent binary from this repo to a remote Linux server and install it.
# Usage: ./scripts/upgrade-agent-remote.sh user@host [linux-amd64|linux-arm64]
#
# Use your normal SSH user (e.g. macdirtycow) with sudo — not root. Hestia VPS hosts
# usually disable root password login (scp: Connection closed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
ARCH_KEY="${2:-linux-amd64}"
REMOTE_DIR="qadbak-agent-upgrade"

if [[ -z "${TARGET}" ]]; then
  echo "Usage: $0 user@host [linux-amd64|linux-arm64]" >&2
  echo "Example: $0 macdirtycow@173.212.250.158 linux-amd64" >&2
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

echo "Preparing ~/${REMOTE_DIR} on ${TARGET}..."
ssh "${TARGET}" "rm -rf ~/${REMOTE_DIR} && mkdir -p ~/${REMOTE_DIR}"

echo "Uploading ${BIN_NAME} to ${TARGET}:~/${REMOTE_DIR}/ ..."
scp "${BIN}" "${MANIFEST}" "${INSTALLER}" "${TARGET}:${REMOTE_DIR}/"

echo "Installing with sudo on server (enter sudo password if prompted)..."
ssh -t "${TARGET}" "sudo bash ~/${REMOTE_DIR}/install.sh ~/${REMOTE_DIR}/${BIN_NAME} ~/${REMOTE_DIR}/manifest.json && rm -rf ~/${REMOTE_DIR}"

echo "Agent upgraded on ${TARGET}. Verify:"
echo "  ssh ${TARGET} '/usr/lib/qadbak-agent/qadbak-agent -version'"
