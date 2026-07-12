#!/usr/bin/env bash
# Verify iOS-bundled agent binaries match manifest and (when dist/ exists) a release build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_AGENT_DIR="${ROOT}/ios/Qadbak/Resources/Agent"
DIST_DIR="${ROOT}/agent/dist"

if [[ "${SKIP_AGENT_REBUILD:-}" != "1" ]]; then
  echo "Building agent from source…"
  bash "${ROOT}/agent/scripts/build-release.sh" >/dev/null
else
  echo "Using existing agent/dist (SKIP_AGENT_REBUILD=1)…"
  [[ -f "${DIST_DIR}/manifest.json" ]] || {
    echo "Missing ${DIST_DIR}/manifest.json — run build-release.sh first." >&2
    exit 1
  }
fi

python3 - "$DIST_DIR/manifest.json" "$IOS_AGENT_DIR/manifest.json" "$DIST_DIR" "$IOS_AGENT_DIR" <<'PY'
import hashlib
import json
import sys

dist_manifest_path, ios_manifest_path, dist_dir, ios_dir = sys.argv[1:5]

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def verify_tree(manifest_path, base_dir, label):
    manifest = load(manifest_path)
    for arch, meta in manifest.get("binaries", {}).items():
        filename = meta.get("file") or f"qadbak-agent-{arch}"
        expected = meta.get("sha256", "").lower()
        path = f"{base_dir}/{filename}"
        actual = sha256_file(path)
        if actual != expected:
            raise SystemExit(
                f"{label} binary checksum mismatch for {arch}\n"
                f"  file: {path}\n"
                f"  manifest: {expected}\n"
                f"  actual:   {actual}\n"
                f"Run bash scripts/copy-agent-to-ios.sh"
            )
    return manifest

ios = verify_tree(ios_manifest_path, ios_dir, "iOS bundle")
dist = verify_tree(dist_manifest_path, dist_dir, "dist")

if ios.get("version") != dist.get("version"):
    raise SystemExit(
        f"Version mismatch: dist={dist.get('version')} ios={ios.get('version')}. "
        "Run bash scripts/copy-agent-to-ios.sh"
    )

for arch in dist.get("binaries", {}):
    filename = dist["binaries"][arch].get("file") or f"qadbak-agent-{arch}"
    dist_hash = sha256_file(f"{dist_dir}/{filename}")
    ios_hash = sha256_file(f"{ios_dir}/{filename}")
    if dist_hash != ios_hash:
        raise SystemExit(
            f"iOS bundle out of sync with source build for {arch}\n"
            f"  dist: {dist_hash}\n"
            f"  ios:  {ios_hash}\n"
            "Rebuild with Go 1.22 (see agent/go.mod toolchain) and run:\n"
            "  bash scripts/copy-agent-to-ios.sh"
        )

print(f"OK: iOS bundle matches agent source build v{dist.get('version')}")
PY
