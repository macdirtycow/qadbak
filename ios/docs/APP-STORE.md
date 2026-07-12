# Qadbak iOS — App Store upload

The app is **free on the App Store** (companion for self-hosted Qadbak panels). Premium is sold separately via [license.inveil.dev](https://license.inveil.dev/buy) on the user's VPS — not as an in-app purchase.

## Prerequisites

1. **Apple Developer Program** — enrolled account ($99/year).
2. **App Store Connect** — create app **Qadbak**, bundle ID `com.qadbak.panel`.
3. **Certificates** — Apple Distribution certificate + App Store provisioning profile for:
   - `com.qadbak.panel` (main app)
   - `com.qadbak.panel.widget` (widget extension)
4. **Capabilities** (Xcode → Signing & Capabilities):
   - Push Notifications (+ APNs key uploaded in App Store Connect **and** on your Qadbak panel)
   - App Groups: `group.com.qadbak.panel` (both targets)
5. **Privacy policy URL** — use [qadbak.com/privacy](https://qadbak.com/privacy).

## TestFlight (quick path)

1. In [App Store Connect](https://appstoreconnect.apple.com), create app **Qadbak** with bundle ID `com.qadbak.panel` (widget: `com.qadbak.panel.widget`).
2. Enable capabilities on the Apple Developer portal: **Push Notifications**, **App Groups** (`group.com.qadbak.panel`).
3. Build and export:

```bash
bash ios/scripts/archive-appstore.sh
```

4. Upload `ios/build/Qadbak-1.1.5-testflight.ipa` with the **Transporter** app (Mac App Store), or Xcode Organizer.
5. In App Store Connect → TestFlight → add internal testers → install via TestFlight app.

## Archive & upload

```bash
# Set your Team ID (10-character string from developer.apple.com)
export DEVELOPMENT_TEAM=XXXXXXXXXX

bash ios/scripts/archive-appstore.sh
```

Then in Xcode: **Window → Organizer → Distribute App → App Store Connect → Upload**.

Or from CLI after archive:

```bash
xcodebuild -exportArchive \
  -archivePath ios/build/Qadbak.xcarchive \
  -exportPath ios/build/export \
  -exportOptionsPlist ios/ExportOptions-appstore.plist
```

## App Store Connect metadata (suggested)

| Field | Value |
|-------|--------|
| Name | Qadbak |
| Subtitle | Hosting panel for your VPS |
| Category | Developer Tools / Business |
| Price | Free |
| Description | Manage domains, DNS, mail, SSL, backups and Qmail on your self-hosted Qadbak panel. Requires your own Qadbak server URL. |
| Support URL | https://qadbak.com |
| Marketing URL | https://qadbak.com |
| Privacy URL | https://qadbak.com/privacy |

**Review notes for Apple:** The app only connects to user-configured panel URLs (no fixed backend). Login uses the customer's own Qadbak instance. Premium features are licensed on the server, not via IAP.

## Screenshots

Capture on iPhone 6.7" and 6.1" (required sizes in App Store Connect):

1. Domain list with stats
2. Domain detail / health
3. Qmail inbox (Premium server)
4. DNS or SSL screen
5. Widget on home screen (optional marketing shot)

## Checklist before submit

- [ ] Version & build number bumped in `Qadbak/Info.plist`
- [ ] Push entitlement enabled if you advertise push
- [ ] TestFlight build tested against production panel (`qadbak.com`)
- [ ] TOTP login tested
- [ ] Export compliance: app uses HTTPS only (ATS); no custom encryption beyond Apple OS

## Support / donate link in app

The account menu includes **Support Qadbak** → opens the Premium subscription page in Safari. This is not an IAP; Apple allows linking to external purchases for server-side software in many cases, but avoid language like "buy Premium in the app" — the app only manages an existing panel.
