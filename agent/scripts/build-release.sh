#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/dist"
mkdir -p "$OUT"
for spec in "linux amd64" "linux arm64"; do
  set -- $spec
  os=$1 arch=$2
  env GOOS=$os GOARCH=$arch CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "${OUT}/qadbak-agent-${os}-${arch}" ./cmd/qadbak-agent
  echo "built ${OUT}/qadbak-agent-${os}-${arch}"
done
