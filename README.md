<div align="center">

# Qadbak

### Self-hosted hosting control panel for Linux VPS.

Admin and client UI for domains, mail, DNS, TLS, databases, backups, and cron — on **your** server. Native **iOS app** for iPhone and iPad. Premium for resellers, webmail, and white-label.

[![License](https://img.shields.io/badge/License-Panel%20use%20only-blue.svg)](LICENSE)
[![iOS app](https://img.shields.io/badge/iOS%20app-1.2.3-0A84FF?logo=apple&logoColor=white)](ios/README.md)
[![Release](https://img.shields.io/github/v/release/macdirtycow/qadbak?label=release)](https://github.com/macdirtycow/qadbak/releases)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04%20%7C%2026.04-E95420?logo=ubuntu&logoColor=white)](docs/LINUX-SUPPORT.md)
[![Debian](https://img.shields.io/badge/Debian-12-D70A53?logo=debian&logoColor=white)](docs/LINUX-SUPPORT.md)
[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org)
[![Premium from €2.50](https://img.shields.io/badge/Premium-from%20%E2%82%AC2.50-14b8a6)](https://qadbak.com/#pricing)
[![Made by Inveil](https://img.shields.io/badge/by-Inveil-94a3b8)](https://inveil.net)

[**Website**](https://qadbak.com) ·
[**Pricing**](https://qadbak.com/#pricing) ·
[**iOS app**](ios/README.md) ·
[**Buy a license**](https://license.inveil.dev/buy) ·
[**Check a license**](https://license.inveil.dev) ·
[**Docs**](docs/) ·
[**About the name**](docs/ABOUT-THE-NAME.md)

</div>

---

## What is Qadbak?

Qadbak is a self-hosted hosting control panel. You install it on a fresh **Ubuntu or Debian** VPS,
sign in, and manage every site, mailbox, DNS record and database from one English
UI — with a clean split between administrators (who run the host) and clients
(who only see their own domains).

It's the alternative for people who want **cPanel-class workflows** without
cPanel's price tag, license server, or 2010 UI — plus a **native iOS app**
that talks to the same panel over HTTPS.

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh
```

Three prompts to start (hostname, admin password, Let's Encrypt email) — then mail hostname, public IP, and optional Premium license and demo client. Post-install verification runs automatically.

## Features

### Core panel

| Area | What you get |
|------|--------------|
| **Domains** | Sites, subdomains, aliases, redirects, reverse proxies. |
| **Mail** | Mailboxes, forwarding, SPF/DKIM/DMARC helpers, delivery logs. |
| **DNS** | BIND9 records + registrar checklist for clients. |
| **TLS** | Let's Encrypt with per-host renewal status. |
| **Databases** | MariaDB per domain, phpMyAdmin shortcut. |
| **Files & terminal** | File manager and shell as the **domain unix user**. |
| **PHP** | Version switching and per-user PHP-FPM pools. |
| **Backups** | Downloadable archives: files, **all mailboxes**, panel settings, DNS zone, certs, crontab. |
| **Operations** | Action journal, undo (mail/DNS), health checks, WordPress install flow. |
| **Cron** | Scheduled jobs with plain-language editor. |
| **Security** | ModSecurity WAF toggle, ClamAV scans, admin firewall UI. |
| **Runtimes** | Node, Python, Docker compose beside PHP-FPM per domain. |
| **Media** | Jellyfin one-click (Docker), per-domain media library folder, HTML5 quick player. |
| **Apps** | 25 one-click catalog installs into `public_html` (incl. Jellyfin). |
| **Backups+** | Offsite S3/B2/GCS, browse archive, restore single files or DB. |
| **Monitoring** | Metrics history, alert rules (email / Slack / Telegram). |
| **API v1** | Bearer keys with scopes — domains, mail, DNS, SSL, suspend, backups. |
| **Billing** | WHMCS module + Blesta starter in `integrations/`. |
| **Panel URLs** | `panel.<domain>` vhosts + Cloudflare Flexible/Full — [CLOUDFLARE.md](docs/CLOUDFLARE.md). |

### Premium (license key)

| Module | Description |
|--------|-------------|
| **Client portal & RBAC** | End customers manage only their domains. |
| **Panel vhost provisioning** | Separate panel URLs per reseller brand. |
| **Qmail** | Built-in IMAP mail in the panel and iOS app. |
| **White-label** | Logo, colours, product name. |
| **License admin** | View activations, move VPS, heartbeat status. |
| **Admin updates** | Pull/rebuild panel from the UI; **Ubuntu LTS release upgrade** (22→24→26). |
| **Offsite backups** | Encrypted cloud credentials + per-domain upload policy. |

Website: [qadbak.com](https://qadbak.com) · Market features: [docs/MARKET-FEATURES.md](docs/MARKET-FEATURES.md)

## iOS app (iPhone & iPad)

Native **SwiftUI** companion for your Qadbak panel — same login, same domains,
Bearer auth (no cookies). Requires **iOS 17+**, a reachable **HTTPS** panel URL,
and mobile API v1 on the server ([docs/MOBILE-IOS-APP.md](docs/MOBILE-IOS-APP.md)).

**Current version:** 1.2.3 (beta) · Source: [`ios/`](ios/) · Build guide: [ios/README.md](ios/README.md)

### Dashboard

| Feature | Description |
|---------|-------------|
| **Domain list** | All hosted domains with running/SSL/container/warning stats |
| **Multi-server** | Save and switch between panel URLs (e.g. production + staging) |
| **Account menu** | Profile, Premium plan label, add domain, panel updates, server shell |
| **Pull to refresh** | Reload domains and widget summary from the panel |
| **Home Screen widget** | Domain count, SSL expiring soon, urgent actions (App Group) |

### Per domain

| Feature | Description |
|---------|-------------|
| **Health** | Public/local probe, SSL days left, repair hints |
| **Logs** | Live error/access log tail with auto-refresh |
| **DNS** | List, add, and delete BIND records |
| **Mail** | Mailboxes — create accounts, quotas, forwarding |
| **Qmail** | Built-in webmail INBOX, read, compose (**Premium** `webmail-ui`) |
| **Files** | Browse `public_html`, view text files, delete |
| **SSL** | Certificate list and Let's Encrypt renew |
| **Backups** | List archives, run backup now, download; **save to iCloud Drive** |
| **Terminal** | Domain shell in-app (xterm + Termux-style extra keys) |

**Backups → iCloud:** archives land in `iCloud Drive/Qadbak Backups/{domain}/`.
Optional auto-save after “Run backup now” and Wi‑Fi-only downloads.

### Admin-only (panel administrator)

| Feature | Description |
|---------|-------------|
| **Add domain** | Provision a new hosted domain from the phone |
| **Panel updates** | Trigger `update-qadbak.sh` flow from the app |
| **Server terminal** | Root/admin shell on the VPS (WebSocket) |

### Security & auth

- Login with username/password; **TOTP** when enabled on the panel
- Refresh tokens in **Keychain**; access tokens in memory
- **Face ID / Touch ID** app lock and sensitive-action confirmation
- **Push notifications** — device token registered with the panel (APNs)
- **Client accounts** — Premium `client-rbac`: clients only see assigned domains

Premium features (Qmail, client login, etc.) follow the **server license** —
the app reads `premiumActive` and capabilities from `GET /api/mobile/v1/me`.

### Get the app

| Channel | How |
|---------|-----|
| **TestFlight** | `bash ios/scripts/archive-appstore.sh` — see [ios/docs/APP-STORE.md](ios/docs/APP-STORE.md) |
| **Sideload (unsigned IPA)** | `bash ios/scripts/build-ipa.sh` → sign with ESign / DefianceSign / Sideloadly |
| **Xcode** | `open ios/Qadbak.xcodeproj` — set Development Team, run on device or simulator |

TestFlight access (public beta): email **support@inveil.net**. The iOS app is
licensed separately — see [ios/LICENSE](ios/LICENSE).

## Pricing

| Plan | Price | Use it for |
|------|-------|------------|
| Pro · **1 month** | **€2.50/mo** | Trying things out (subscription) |
| Pro · 3 months | €7.45 | Short project |
| Pro · 6 months | €10.50 | Half-year of hosting |
| Pro · **1 year** ★ Most popular | **€20** | Annual usage |
| Pro · **3 years** | **€55** | Billed every 3 years (subscription) |

All plans cover **50 domains** on **1 VPS** with full Premium modules. Monthly
plans are **Stripe subscriptions** (renew until cancelled in Stripe). The panel
runs without a Premium key for single-admin use — Premium unlocks multi-tenant
client modules, RBAC, panel-vhost provisioning, per-user PHP-FPM isolation,
Qmail, and live admin updates.

> [Buy a license →](https://license.inveil.dev/buy) · [Check or refund an existing key →](https://license.inveil.dev) · [Refund policy](https://qadbak.com/refund)

## Why Qadbak vs the classics?

|                                 | **Qadbak** | cPanel | Plesk | HestiaCP |
|---------------------------------|:----------:|:------:|:-----:|:--------:|
| Starting price / month          | **€2.50**  | ~€35   | ~€15  | Free     |
| 3-year subscription (€55)       | **€55**    |   ✗    |   ✗   | Free     |
| Modern web UI                   | ✅         | Legacy | Mixed | Functional |
| Native iOS app                | ✅ Beta    | Apps   | Apps  | ✗        |
| Admin / client role split       | ✅ Native  | WHM    | ✅    | ✅       |
| Panel license (self-host)       | ✅ Panel use |   ✗    |   ✗   | GPL      |
| EU-based vendor (GDPR)          | 🇳🇱 NL   |  🇺🇸  | EU+US | EU       |
| Activation in <1 minute         | Email key  | License srv | License key | Install only |

## Quick start (local dev)

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

On first start `data/users.json` is created from `data/users.example.json`:

| User | Default password | Role |
|------|-----------------|------|
| `admin` | `changeme` | administrator |
| `client` | `changeme` | client (mock domain `example.com`) |

Hash your own password before sharing:

```bash
node scripts/hash-password.mjs your-password
```

## Install on a VPS

**Requirements (full stack):** Ubuntu 22.04/24.04/26.04 or Debian 12, root, DNS A-record, 1 GB+ RAM. **Panel-only:** any Linux with Node 20+ — see [docs/LINUX-SUPPORT.md](docs/LINUX-SUPPORT.md).

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh
```

The installer:
1. Installs nginx, Apache, MariaDB, Postfix, Dovecot, BIND, PHP-FPM, certbot.
2. Clones Qadbak to `/opt/qadbak`, runs `npm install && npm run build`.
3. Creates the system user `qadbak`, sets up pm2 + systemd.
4. Generates a `SESSION_SECRET`, writes `/opt/qadbak/.env.local`.
5. Asks for panel hostname, mail hostname, public IP, admin password, optional Premium license, optional demo client.
6. Optionally issues a Let's Encrypt certificate for the panel host.
7. Runs `post-install-verify.sh` (preflight + API + optional Playwright E2E).

When it's done, open `https://your-panel-host/login`. Optional: `sudo bash scripts/configure-ufw-qadbak.sh` for UFW.

**iOS app:** point the app at your panel URL after install — see [iOS app](#ios-app-iphone--ipad) and [docs/MOBILE-IOS-APP.md](docs/MOBILE-IOS-APP.md).

### Panel-only (any Linux + Node 20+)

```bash
sudo bash install/qadbak-install-panel.sh
```

See [docs/LINUX-SUPPORT.md](docs/LINUX-SUPPORT.md#panel-only).

### Resume a partial install

```bash
sudo bash /opt/qadbak/install/qadbak-install-resume.sh
```

### Update on the server

```bash
cd /opt/qadbak && sudo bash scripts/update-qadbak.sh
```

Premium admins can also update from **Admin → Updates** (Qadbak pull/rebuild, apt packages, and Ubuntu LTS release upgrade).

Panel unreachable after update (Cloudflare **520** or `panel.<domain>`):

```bash
sudo bash /opt/qadbak/scripts/fix-panel-now.sh
sudo bash /opt/qadbak/scripts/diagnose-panel-access.sh panel.example.com
```

That's the whole update flow for all customers. Premium modules in this repo
are gated by `isPremiumFeatureEnabled()` against the license server's
feature list — there is no encrypted artifact to download and no
second activation step. `git pull && npm run build && pm2 restart` is
equivalent under the hood.

### Bought a Premium license on an existing install?

One-shot pull + rebuild + activate:

```bash
sudo bash /opt/qadbak/scripts/buy-premium.sh QAD-XXXX-YYYY-ZZZZ-WWWW
```

### Uninstall

```bash
sudo bash /opt/qadbak/install/qadbak-uninstall.sh           # safe default
sudo bash /opt/qadbak/install/qadbak-uninstall.sh --help    # all flags
sudo bash /opt/qadbak/install/qadbak-uninstall.sh --dry-run # preview, no changes
```

Defaults are conservative — only the Qadbak panel is removed. Use
`--remove-stack` / `--remove-customers` for a full wipe (test VPS only).

## Architecture

```mermaid
flowchart LR
    B[Browser] -->|"HTTPS · 80/443"| N[nginx]
    I[iOS app] -->|"HTTPS · Bearer"| Q
    N -->|"panel host"| Q[Qadbak — Next.js]
    N -->|"customer domain"| A[Apache + PHP-FPM]
    Q -->|"server-side only"| P["Native provisioner<br/>scripts/provisioning-helper.mjs"]
    P --> S["nginx · Apache · MariaDB<br/>Postfix · Dovecot · BIND"]
    Q -.->|"license heartbeat"| L[("license.inveil.dev")]
```

- **Auth:** JWT (httpOnly cookie), users in `data/users.json`.
- **RBAC:** `src/lib/rbac.ts` + `src/lib/features.ts`.
- **Domains:** `data/native-domains.json` + host helpers.
- **Audit log:** `data/audit.log`.
- **Self-host first:** all sites, mail and DBs live on YOUR VPS. The only
  outbound call is a small license heartbeat — see [Privacy](https://qadbak.com/privacy).

## Project layout

```
src/app/          Next.js routes (UI + API)
src/lib/          provisioner, auth, RBAC, domain helpers
src/components/   UI per domain / admin
scripts/          install, native helpers, update, tests
install/          qadbak-install.sh, qadbak-uninstall.sh
deploy/           nginx examples
ios/              Native SwiftUI app + widget (iPhone/iPad)
docs/             guides and checklists
data/             users.example.json (template)
marketing-site/   static HTML for qadbak.com + legal pages
```

## Documentation

| File | Contents |
|------|----------|
| [docs/INVEIL-MIGRATION.md](docs/INVEIL-MIGRATION.md) | Rebrand checklist — DNS, license server, email |
| [docs/MOBILE-IOS-APP.md](docs/MOBILE-IOS-APP.md) | Mobile API, Bearer auth, push, widgets, iCloud backups |
| [ios/README.md](ios/README.md) | Xcode setup, IPA build, TestFlight, feature list |
| [ios/docs/APP-STORE.md](ios/docs/APP-STORE.md) | App Store / TestFlight submission |
| [docs/LINUX-SUPPORT.md](docs/LINUX-SUPPORT.md) | Ubuntu/Debian native + panel-only + LTS upgrade |
| [docs/MEDIA-JELLYFIN.md](docs/MEDIA-JELLYFIN.md) | Jellyfin, media library, HTML5 player |
| [docs/QADBAK-NATIVE-INSTALL.md](docs/QADBAK-NATIVE-INSTALL.md) | Native VPS install in depth |
| [docs/V1-TEST-SERVER.md](docs/V1-TEST-SERVER.md) | Step-by-step test server |
| [docs/UBUNTU-24-LTS.md](docs/UBUNTU-24-LTS.md) | Ubuntu version notes |
| [docs/PHASE-8-INDEPENDENT.md](docs/PHASE-8-INDEPENDENT.md) | Independent native mode |
| [docs/E2E-CHECKLIST.md](docs/E2E-CHECKLIST.md) | Sign-off checklist |
| [docs/PHASES.md](docs/PHASES.md) | Feature phases |
| [docs/MARKET-FEATURES.md](docs/MARKET-FEATURES.md) | Market competition phases 1–8 |
| [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md) | Cloudflare 502/520 + panel SSL |
| [docs/integrations/WHMCS-INTEGRATION.md](docs/integrations/WHMCS-INTEGRATION.md) | WHMCS + API v1 |
| [docs/api/openapi.yaml](docs/api/openapi.yaml) | REST API v1 OpenAPI |
| [docs/HOSTING-NGINX.md](docs/HOSTING-NGINX.md) | nginx + Apache for sites |
| [docs/TERMINAL-NATIVE.md](docs/TERMINAL-NATIVE.md) | In-panel terminal |
| [docs/MIGRATE-FROM-LEGACY-HOSTING.md](docs/MIGRATE-FROM-LEGACY-HOSTING.md) | Migrate from another panel |
| [docs/ABOUT-THE-NAME.md](docs/ABOUT-THE-NAME.md) | Why "Qadbak" |

## Common commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (mocked native ops) |
| `npm run build` | Production Next.js build |
| `npm run test-api` | API + domain-registry sanity check |
| `npm run preflight` | VPS checks (env, ports, services) |
| `bash scripts/update-qadbak.sh` | Pull + build + restart pm2 |
| `sudo bash install/qadbak-install.sh` | Fresh VPS install |
| `sudo bash install/qadbak-uninstall.sh` | Remove the panel cleanly |

## Marketing site (qadbak.com)

Pricing, feature copy, and **live demo** CTAs live in `marketing-site/`. The panel serves them at `/` via
`npm run build` (runs `scripts/sync-landing-public.sh` for CSS/JS assets).

**Live demo:** [demo.qadbak.com](https://demo.qadbak.com/login) — enable on your VPS with
`sudo bash scripts/apply-demo-vhost.sh` ([docs/DEMO.md](docs/DEMO.md)).

**After changing prices or terms**, redeploy so qadbak.com updates:

```bash
cd /opt/qadbak && git pull && sudo -u qadbak npm run build
sudo bash scripts/pm2-restart-qadbak.sh
```

Static-only host (no Next.js): rebuild and upload the zip:

```bash
bash scripts/build-marketing-zip.sh   # dist/qadbak-site-upload.zip
```

Static pages included: landing, about, privacy, terms, refund. Checkout prices
always come from `license.inveil.dev/buy` (license-server repo).

## Contributing

External pull requests are accepted for bug fixes and documentation only — see
[CONTRIBUTING.md](CONTRIBUTING.md). New features are scoped through GitHub
issues first.

Security disclosures: please email **security@inveil.net** rather than opening
a public issue. See [SECURITY.md](.github/SECURITY.md).

## About the name

In 2009, [Qadbak Investments](https://en.wikipedia.org/wiki/Qadbak_Investments)
made headlines around Notts County and BMW Sauber F1 — later remembered as hype
without substance. This panel reuses the name for the **opposite**: working
code on **your** server (not affiliated with that entity). Full story:
[docs/ABOUT-THE-NAME.md](docs/ABOUT-THE-NAME.md) or `/about` inside the panel.

## License

**Qadbak Panel License** — panel use only. Copyright © 2026 MacDirtyCow /
Qadbak and Inveil.

You may install and run the panel on servers you control to manage hosting.
You may **not** redistribute, mirror, or republish the software as your own
product. Premium modules require a paid license key (heartbeat via
`license.inveil.dev`) — see [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md).

The iOS companion app has separate terms: [ios/LICENSE](ios/LICENSE).

See [LICENSE](LICENSE), [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md),
[NOTICE](NOTICE), and [Terms of Service](https://qadbak.com/terms).
