#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="${ROOT}/dist"
VERSION="$(grep 'const version' "${ROOT}/cmd/qadbak-agent/main.go" | sed -n 's/.*"\(.*\)".*/\1/p')"
MIN_APP="1.2.0"
mkdir -p "$OUT"

export GOTOOLCHAIN="${GOTOOLCHAIN:-go1.22.0}"

for spec in "linux amd64" "linux arm64"; do
  set -- $spec
  os=$1
  arch=$2
  name="qadbak-agent-${os}-${arch}"
  env GOOS=$os GOARCH=$arch CGO_ENABLED=0 go build -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o "${OUT}/${name}" ./cmd/qadbak-agent
  echo "built ${OUT}/${name}"
done

sha256sum "${OUT}"/qadbak-agent-linux-* > "${OUT}/SHA256SUMS"

python3 - "$OUT/manifest.json" "$VERSION" "$MIN_APP" <<'PY'
import hashlib
import json
import os
import sys

out, version, min_app = sys.argv[1], sys.argv[2], sys.argv[3]
root = os.path.dirname(out)
binaries = {}
for arch in ("linux-amd64", "linux-arm64"):
    path = os.path.join(root, f"qadbak-agent-{arch}")
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    binaries[arch] = {"sha256": h.hexdigest(), "file": os.path.basename(path)}
manifest = {
    "version": version,
    "minAppVersion": min_app,
    "minAgentVersion": version,
    "binaries": binaries,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
print(f"wrote {out}")
PY

echo "SHA256SUMS:"
cat "${OUT}/SHA256SUMS"
