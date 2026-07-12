#!/usr/bin/env bash
# Verify iOS-bundled agent binaries match a fresh release build from source.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_AGENT_DIR="${ROOT}/ios/Qadbak/Resources/Agent"
DIST_DIR="${ROOT}/agent/dist"

echo "Building agent from source…"
bash "${ROOT}/agent/scripts/build-release.sh" >/dev/null

python3 - "$DIST_DIR/manifest.json" "$IOS_AGENT_DIR/manifest.json" "$DIST_DIR" "$IOS_AGENT_DIR" <<'PY'
import hashlib
import json
import sys

dist_manifest_path, ios_manifest_path, dist_dir, ios_dir = sys.argv[1:5]

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

dist = load(dist_manifest_path)
ios = load(ios_manifest_path)

if dist.get("version") != ios.get("version"):
    raise SystemExit(
        f"Version mismatch: dist={dist.get('version')} ios={ios.get('version')}. "
        "Run bash scripts/copy-agent-to-ios.sh"
    )

for arch, meta in dist.get("binaries", {}).items():
    filename = meta.get("file") or f"qadbak-agent-{arch}"
    expected = meta.get("sha256", "").lower()
    ios_meta = ios.get("binaries", {}).get(arch, {})
    ios_expected = ios_meta.get("sha256", "").lower()
    if expected != ios_expected:
        raise SystemExit(f"manifest.json sha256 mismatch for {arch}")

    for base in (dist_dir, ios_dir):
        path = f"{base}/{filename}"
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        actual = h.hexdigest()
        if actual != expected:
            raise SystemExit(
                f"Binary checksum mismatch for {path}\n"
                f"  expected {expected}\n"
                f"  actual   {actual}\n"
                "Run bash scripts/copy-agent-to-ios.sh"
            )

print(f"OK: iOS bundle matches agent source build v{dist.get('version')}")
PY
