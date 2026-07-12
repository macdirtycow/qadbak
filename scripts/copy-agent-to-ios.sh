#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "${ROOT}/agent/scripts/build-release.sh"
mkdir -p "${ROOT}/ios/Qadbak/Resources/Agent"
cp "${ROOT}/agent/dist/qadbak-agent-linux-amd64" "${ROOT}/agent/dist/qadbak-agent-linux-arm64" \
  "${ROOT}/ios/Qadbak/Resources/Agent/"
echo "Copied agent binaries to ios/Qadbak/Resources/Agent/"
