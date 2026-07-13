#!/usr/bin/env bash
# Upload bundled agent binary from this repo to a remote Linux server and install it.
# Usage: ./scripts/upgrade-agent-remote.sh user@host [linux-amd64|linux-arm64]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
ARCH_KEY="${2:-linux-amd64}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 user@host [linux-amd64|linux-arm64]" >&2
  exit 1
fi

case "$ARCH_KEY" in
  linux-amd64) BIN_NAME="qadbak-agent-linux-amd64" ;;
  linux-arm64) BIN_NAME="qadbak-agent-linux-arm64" ;;
  *) echo "Unknown arch key: $ARCH_KEY" >&2; exit 1 ;;
esac

BIN="$ROOT/ios/Qadbak/Resources/Agent/$BIN_NAME"
MANIFEST="$ROOT/ios/Qadbak/Resources/Agent/manifest.json"
INSTALLER="$ROOT/agent/packaging/install.sh"

[[ -f "$BIN" ]] || { echo "Missing $BIN — run: bash scripts/copy-agent-to-ios.sh" >&2; exit 1; }
[[ -f "$INSTALLER" ]] || { echo "Missing $INSTALLER" >&2; exit 1; }

REMOTE_BIN="/tmp/$BIN_NAME"
echo "→ Uploading $BIN_NAME to $TARGET…"
scp "$BIN" "$MANIFEST" "$INSTALLER" "$TARGET:/tmp/"
echo "→ Installing (requires sudo on server)…"
ssh -t "$TARGET" "sudo bash /tmp/install.sh '$REMOTE_BIN' /tmp/manifest.json && rm -f '$REMOTE_BIN' /tmp/manifest.json /tmp/install.sh"
echo "✓ Agent upgraded on $TARGET"
