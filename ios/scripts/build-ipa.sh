#!/usr/bin/env bash
# Build an unsigned Release IPA for on-device signing (ESign, Sideloadly, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Qadbak/Info.plist)"
DERIVED="$ROOT/build/DerivedData"
APP="$DERIVED/Build/Products/Release-iphoneos/Qadbak.app"
IPA="$ROOT/build/Qadbak-${VERSION}.ipa"
STAGING="$ROOT/build/ipa"

echo "→ Building Qadbak ${VERSION} (iphoneos, unsigned)…"
rm -rf "$STAGING" "$IPA"
xcodebuild \
  -project Qadbak.xcodeproj \
  -scheme Qadbak \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM="" \
  build

if [[ ! -d "$APP" ]]; then
  echo "error: expected app bundle at $APP" >&2
  exit 1
fi

mkdir -p "$STAGING/Payload"
cp -R "$APP" "$STAGING/Payload/"
( cd "$STAGING" && zip -qr "$IPA" Payload )

echo "✓ IPA ready: $IPA"
ls -lh "$IPA"
