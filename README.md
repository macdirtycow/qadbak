# Qadbak

**Panel:** [qadbak.com](https://qadbak.com)  
**Omiiba:** [omiiba.dev](https://omiiba.dev) · [omiiba.com](https://omiiba.com)

**Qadbak** is an independent **hosting control panel** for your VPS — domains, email, databases, DNS, SSL, files, backups, cron, and server admin in one English UI. Native provisioning on the host (nginx, Apache, Postfix, Dovecot, MariaDB, BIND). No separate GPL control-panel install required.

### About the name

In 2009, [Qadbak Investments](https://en.wikipedia.org/wiki/Qadbak_Investments) made headlines around Notts County and BMW Sauber F1 — later remembered as hype without substance. This panel **reuses the name** for the opposite: working code on **your** server (not affiliated with that entity). Story: [docs/ABOUT-THE-NAME.md](docs/ABOUT-THE-NAME.md) · in-app: `/about`.

> **Status:** Production-ready on a **dedicated VPS**. Use [docs/V1-TEST-SERVER.md](docs/V1-TEST-SERVER.md) for a full test run. Do not experiment on servers with live customer sites.

## Requirements

- **Ubuntu 22.04 or 24.04 LTS** VPS (recommended)
- Node.js 20+
- Root access for install scripts

## Install on a VPS (evaluation)

The public repository is **proprietary source code** published for transparency and
**personal, non-commercial evaluation** on a VPS you own. Commercial hosting and
Premium features require a license — see [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md). Modules are delivered via the license server after activation (no extra GitHub access).

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
sudo bash install/qadbak-install.sh
```

The installer uses the **`main`** branch on GitHub. Premium module **source** and the license **server** are not in this repo — customers receive modules via the license server after activation ([COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md)).
This installs the hosting stack, Qadbak (`/opt/qadbak`), native provisioning, pm2, and
nginx. See [install/README.md](install/README.md) and [docs/QADBAK-NATIVE-INSTALL.md](docs/QADBAK-NATIVE-INSTALL.md).

## Update on the server

```bash
cd /opt/qadbak && sudo bash scripts/update-qadbak.sh
```

## Quick start (local development)

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
cp .env.example .env.local
```

In `.env.local`:

```env
SESSION_SECRET=a-long-random-string-at-least-16-characters
VIRTUALMIN_MOCK=true
QADBAK_COOKIE_SECURE=false
```

```bash
npm install
npm run dev
```

Open http://localhost:3000 — on first start, `data/users.json` is created from `data/users.example.json`:

| User | Default password | Role |
|------|------------------|------|
| `admin` | `changeme` | administrator |
| `client` | `changeme` | client (mock: `example.com`) |

Change passwords before sharing:

```bash
node scripts/hash-password.mjs your-password
```

## Production configuration

On the server, `.env.local` (not in git) should include:

```env
QADBAK_PROVISIONER=native
QADBAK_VIRTUALMIN_FALLBACK=false
QADBAK_DISABLE_WEBMIN=true
QADBAK_PUBLIC_HOST=panel.example.com
SESSION_SECRET=...
PORT=3000
```

See [.env.example](.env.example). Verify:

```bash
curl -s http://127.0.0.1:3000/api/health
npm run test-api
bash scripts/v1-test-preflight.sh
```

Deploy behind nginx: [deploy/nginx-qadbak.conf](deploy/nginx-qadbak.conf).

## Marketing site (qadbak.com)

Static landing page matching the panel UI:

```bash
bash scripts/build-marketing-zip.sh
```

Output: **`dist/qadbak-site-upload.zip`** — see `marketing-site/README-UPLOAD.txt`.

The live homepage at `/` uses the same content from `marketing-site/index.html`.

## Documentation

| File | Contents |
|------|----------|
| [docs/QADBAK-NATIVE-INSTALL.md](docs/QADBAK-NATIVE-INSTALL.md) | Native VPS install |
| [docs/V1-TEST-SERVER.md](docs/V1-TEST-SERVER.md) | Step-by-step test server |
| [docs/PHASE-8-INDEPENDENT.md](docs/PHASE-8-INDEPENDENT.md) | Independent native mode |
| [docs/E2E-CHECKLIST.md](docs/E2E-CHECKLIST.md) | Sign-off checklist |
| [docs/PHASES.md](docs/PHASES.md) | Feature phases |
| [docs/HOSTING-NGINX.md](docs/HOSTING-NGINX.md) | nginx + Apache for sites |
| [docs/TERMINAL-NATIVE.md](docs/TERMINAL-NATIVE.md) | In-panel terminal |
| [docs/ABOUT-THE-NAME.md](docs/ABOUT-THE-NAME.md) | Why “Qadbak” |

## Features (overview)

| Area | Capabilities |
|------|----------------|
| Domains | Create, enable/disable, lifecycle, limits |
| Web | Files, PHP, SSL, redirects, proxies, scripts |
| Mail | Mailboxes, IMAP, logs, settings |
| DNS | Records via native BIND integration |
| Data | MySQL/MariaDB databases, backups, cron |
| Server | Services, stack reload, metrics, terminal |

In-app phase map: `/fases`.

## Architecture

```
Browser → https://your-panel-host (80/443 or :11000)
              ↓ nginx
         Qadbak (Next.js — auth, RBAC, English UI)
              ↓ server-side
         Native provisioner (scripts/provisioning-helper.mjs)
              ↓
         nginx, Apache, Postfix, Dovecot, MariaDB, BIND on the VPS
```

- **Auth:** JWT (httpOnly), users in `data/users.json`
- **RBAC:** `src/lib/rbac.ts` + `src/lib/features.ts`
- **Domains:** `data/native-domains.json` + host helpers
- **Audit:** `data/audit.log`

## Project structure

```
src/app/          Next.js routes (UI + API)
src/lib/          provisioner, auth, rbac, domain helpers
src/components/   UI per domain / admin
scripts/          install, native helpers, update, tests
install/          qadbak-install.sh
deploy/           nginx examples
docs/             guides and checklists
data/             users.example.json (template)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test-api` | API / domain registry check |
| `npm run preflight` | VPS checks |
| `bash scripts/update-qadbak.sh` | Pull, build, restart on server |
| `sudo bash install/qadbak-install.sh` | Fresh VPS install |

## License

**Proprietary — All Rights Reserved.** Copyright (c) 2026 MacDirtyCow / Qadbak and Omiiba.

The source is public on GitHub for auditing and **evaluation on your own VPS only**.
Forking, redistribution, commercial use, and Premium features without a written license
are **not permitted**. See [LICENSE](LICENSE) and [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md).
