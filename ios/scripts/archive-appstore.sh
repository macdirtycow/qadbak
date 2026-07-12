#!/usr/bin/env bash
# Archive Qadbak for TestFlight / App Store Connect.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEAM_ID="${DEVELOPMENT_TEAM:?Set DEVELOPMENT_TEAM to your 10-character Apple Team ID}"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Qadbak/Info.plist)"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' Qadbak/Info.plist)"
ARCHIVE="$ROOT/build/Qadbak.xcarchive"
EXPORT_DIR="$ROOT/build/export"
EXPORT_PLIST="$ROOT/ExportOptions-appstore.plist"

echo "→ Archiving Qadbak ${VERSION} (${BUILD}) for TestFlight (team ${TEAM_ID})…"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
xcodebuild \
  -project Qadbak.xcodeproj \
  -scheme Qadbak \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  archive

/usr/libexec/PlistBuddy -c "Add :teamID string ${TEAM_ID}" "$EXPORT_PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :teamID ${TEAM_ID}" "$EXPORT_PLIST"

echo "→ Exporting signed IPA…"
if xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates; then
  IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
  if [[ -n "$IPA" ]]; then
    cp "$IPA" "$ROOT/build/Qadbak-${VERSION}-testflight.ipa"
    echo "✓ TestFlight IPA: $ROOT/build/Qadbak-${VERSION}-testflight.ipa"
  fi
else
  echo "⚠ Export skipped (App Store Connect login required)." >&2
  echo "  Open Xcode → Window → Organizer → Archives → Distribute App → TestFlight" >&2
fi

echo "✓ Archive: $ARCHIVE"
