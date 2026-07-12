# Qadbak iOS app

Native SwiftUI client for iPhone and iPad. **Version 1.2.3** (TestFlight beta). Requires **iOS 17+**.

Also published at [github.com/macdirtycow/qadbak-ios](https://github.com/macdirtycow/qadbak-ios). This folder stays in sync with the main Qadbak repo.

**License:** companion app terms in [LICENSE](LICENSE). Use only on infrastructure you are allowed to manage.

## Two connection modes

### 1. Qadbak panel (full)

Enter your panel URL (HTTPS), sign in with username/password (+ TOTP if enabled). You manage domains, DNS, mail, SSL, backups, files, and terminal the same way as in the browser.

### 2. Linux agent (existing server)

For a VPS that already runs HestiaCP, Coolify, CasaOS, or plain Linux:

1. **Servers → Add server → Linux server via SSH**
2. App installs `qadbak-agent` v0.5.0 and pairs on port **9443**
3. Dashboard: CPU, RAM, disk, services, Docker, logs, apt updates, reboot
4. If a panel is detected: tap **Link panel** and enter API credentials (read-only)

Supported panel links: **HestiaCP**, **Coolify**, **CasaOS**. Plesk and DirectAdmin are detected but not linkable yet.

Docs: [docs/ios/EXTERNAL_SERVERS.md](../docs/ios/EXTERNAL_SERVERS.md), [docs/agent/PANEL-LINKING.md](../docs/agent/PANEL-LINKING.md)

## Features (Qadbak panel path)

| Area | Notes |
|------|--------|
| Domains | List, add, health, live logs |
| DNS | CRUD on BIND records |
| Mail | Mailboxes, quotas |
| Qmail | Webmail (Premium) |
| SSL | Renew Let's Encrypt |
| Backups | Run, download, optional iCloud copy |
| Files | Browse domain home |
| Terminal | Domain user + admin root shell |
| Widget | Domain count, SSL warnings |
| Push | APNs when panel is configured |
| Multi-server | Switch saved panel URLs |
| Client login | Premium RBAC: own domains only |

## Open in Xcode

```bash
open ios/Qadbak.xcodeproj
```

1. Scheme **Qadbak**
2. **Development Team** on Qadbak + QadbakWidgetExtension
3. Capabilities: App Groups (`group.com.qadbak.panel`), Push, iCloud (`iCloud.com.qadbak.panel`)
4. Run on device or simulator (iOS 17+)

Before testing SSH agent install from Xcode, build agent binaries into the app bundle:

```bash
bash scripts/copy-agent-to-ios.sh
```

## TestFlight

Email **support@inveil.net** for an invite.

Build for upload:

```bash
bash ios/scripts/archive-appstore.sh
```

Then Xcode → Organizer → Distribute App → TestFlight. Details: [docs/APP-STORE.md](docs/APP-STORE.md).

## Unsigned IPA (sideload)

```bash
bash ios/scripts/build-ipa.sh
```

Output: `ios/build/Qadbak-1.2.3.ipa` (arm64). Sign with ESign, DefianceSign, or Sideloadly using your certificate + provisioning profile.

## Local dev (panel path)

```bash
npm run dev
npm run test:mobile-auth
```

Simulator panel URL: `http://127.0.0.1:3000`

## Project layout

```
ios/
  Qadbak/                 Main app
  QadbakWidget/           Home Screen widget
  Qadbak/Resources/Agent/ Bundled qadbak-agent binaries + manifest.json
```

API reference: [docs/MOBILE-IOS-APP.md](../docs/MOBILE-IOS-APP.md)
