# Qadbak iOS app

> **Standalone repo:** [github.com/macdirtycow/qadbak-ios](https://github.com/macdirtycow/qadbak-ios)

Native **SwiftUI** client for iPhone and iPad (Phases A–C). Source of truth for the app lives in the `qadbak-ios` repository; this folder is kept in sync for panel development.

## Open in Xcode

```bash
open ios/Qadbak.xcodeproj
```

1. Select the **Qadbak** scheme.
2. Set your **Development Team** (Signing & Capabilities) on both **Qadbak** and **QadbakWidgetExtension**.
3. Enable **App Groups** (`group.com.qadbak.panel`) and **Push Notifications** on the main target.
4. Run on simulator or device (iOS 17+).

## Features

### Phase B (MVP)
- Login + TOTP, domain list/detail
- DNS editor, mail accounts, SSL renew, backup trigger

### Phase C (App Store)
- **Push** — APNs token registration with the panel
- **Widget** — Home Screen widget (domain count, SSL alerts)
- **Files** — browse domain home, view text files, delete
- **Webmail** — INBOX, read messages, compose (requires Premium `webmail-ui` on server)
- **Client login** — Premium `client-rbac`: only assigned domains, client badge in UI

## First launch

1. Panel URL, e.g. `https://qadbak.com` or `http://127.0.0.1:3000` (local dev).
2. Sign in; refresh token stored in Keychain.
3. Add the **Qadbak** widget from the home screen (after opening the app once).

## Local development

```bash
npm run dev
npm run test:mobile-auth
```

Simulator URL: `http://127.0.0.1:3000`

## TestFlight

```bash
bash ios/scripts/archive-appstore.sh
```

Then **Xcode → Organizer → Distribute App → TestFlight**. Details: [`docs/APP-STORE.md`](docs/APP-STORE.md).

## Project layout

```
ios/
  Qadbak/              Main app
  QadbakWidget/        WidgetKit extension
```

API reference: [`docs/MOBILE-IOS-APP.md`](../docs/MOBILE-IOS-APP.md)

## IPA (sideload / ESign / DefianceSign)

Build an **unsigned** Release IPA for on-device signing:

```bash
bash ios/scripts/build-ipa.sh
```

Output: `ios/build/Qadbak-1.0.0.ipa` (arm64, iOS 17+).

### Install on iPhone

1. Copy the `.ipa` to your iPhone (AirDrop, Files, etc.).
2. Open your signing app (e.g. **ESign**, **DefianceSign**).
3. Import your **.p12** certificate + **.mobileprovision**.
4. Import the IPA → **Sign** → **Install**.
5. Trust the profile under **Settings → General → VPN & Device Management**.

**Note:** Widget and push use App Groups / push entitlements. If signing fails, remove those entitlements in the signer or use a developer certificate that includes `com.qadbak.panel` and `group.com.qadbak.panel`.
