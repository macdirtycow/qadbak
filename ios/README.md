# Qadbak iOS app

Native **SwiftUI** client for iPhone and iPad (Phases A–C).

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

## Project layout

```
ios/
  Qadbak/              Main app
  QadbakWidget/        WidgetKit extension
```

API reference: [`docs/MOBILE-IOS-APP.md`](../docs/MOBILE-IOS-APP.md)
