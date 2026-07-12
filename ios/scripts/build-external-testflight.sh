#!/usr/bin/env bash
# Build, export, and (optionally) upload + configure External TestFlight.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Step 1/3: Archive + export App Store IPA…"
bash "$ROOT/scripts/archive-appstore.sh"

IPA="$ROOT/build/export/Qadbak.ipa"
if [[ ! -f "$IPA" ]]; then
  echo "No IPA exported." >&2
  exit 1
fi

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Qadbak/Info.plist)"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' Qadbak/Info.plist)"
cp "$IPA" "$ROOT/build/Qadbak-${VERSION}-external-${BUILD}.ipa"
echo "✓ IPA: $ROOT/build/Qadbak-${VERSION}-external-${BUILD}.ipa"

if [[ -z "${ASC_ISSUER_ID:-}" ]]; then
  echo ""
  echo "→ Step 2/3: Upload (manual — set ASC_ISSUER_ID for CLI upload)"
  echo "  Xcode-beta → Organizer → Distribute App → App Store Connect → Upload"
  echo "  Or: export ASC_ISSUER_ID=... && bash scripts/upload-testflight.sh"
  echo ""
  echo "→ Step 3/3: External testing (after upload + processing)"
  echo "  export ASC_ISSUER_ID=..."
  echo "  python3 scripts/setup-external-testflight.py --wait"
  exit 0
fi

echo "→ Step 2/3: Upload to App Store Connect…"
bash "$ROOT/scripts/upload-testflight.sh" "$IPA"

echo "→ Step 3/3: External TestFlight group + Beta App Review…"
python3 "$ROOT/scripts/setup-external-testflight.py" --wait --version "$VERSION" --build "$BUILD"
