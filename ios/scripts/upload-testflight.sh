#!/usr/bin/env bash
# Upload a signed Qadbak IPA to TestFlight via App Store Connect API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IPA="${1:-$ROOT/build/export/Qadbak.ipa}"
KEY_ID="${ASC_KEY_ID:-TXY8G26YBJ}"
KEY_PATH="${ASC_KEY_PATH:-$HOME/Downloads/AuthKey_${KEY_ID}.p8}"
ISSUER_ID="${ASC_ISSUER_ID:-}"

if [[ ! -f "$IPA" ]]; then
  echo "IPA not found: $IPA" >&2
  echo "Run: bash ios/scripts/archive-appstore.sh" >&2
  exit 1
fi

if [[ -z "$ISSUER_ID" ]]; then
  echo "Set ASC_ISSUER_ID (App Store Connect → Users and Access → Integrations → Issuer ID)." >&2
  exit 1
fi

mkdir -p "$HOME/.appstoreconnect/private_keys"
cp "$KEY_PATH" "$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"
chmod 600 "$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"

echo "→ Uploading $(basename "$IPA") to TestFlight…"
xcrun altool --upload-app \
  -f "$IPA" \
  -t ios \
  --apiKey "$KEY_ID" \
  --apiIssuer "$ISSUER_ID"

echo "✓ Upload started. Check App Store Connect → Qadbak → TestFlight in ~5–15 min."
