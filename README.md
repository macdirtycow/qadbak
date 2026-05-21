# Qadbak

**Qadbak (this product):** [qadbak.com](https://qadbak.com)  
**Omiiba (official):** [omiiba.dev](https://omiiba.dev) · [omiiba.com](https://omiiba.com)

**Qadbak** is a modern English UI layer **on top of** [VirtualMin](https://virtualmin.com) / Webmin — not a fork. Domains, email, databases, DNS, SSL, server management, and Webmin login links with role-based access (admin / client).

### About the name

In 2009, [Qadbak Investments](https://en.wikipedia.org/wiki/Qadbak_Investments) made headlines around Notts County and BMW Sauber F1 — later remembered as hype without substance. This panel **reuses the name** for the opposite: working code on your VPS, as the **front door** to VirtualMin (not affiliated with that entity). Story: [docs/ABOUT-THE-NAME.md](docs/ABOUT-THE-NAME.md) · in-app: `/about`.

> **Status:** v1 code complete — validate on a **dedicated test VPS** ([docs/V1-TEST-SERVER.md](docs/V1-TEST-SERVER.md)). Do not install on production hosts (e.g. mareades).

## Requirements

- Node.js 20+
- VirtualMin with Remote API (`remote.cgi`) for production
- **Testing:** dedicated VPS only — [docs/V1-TEST-SERVER.md](docs/V1-TEST-SERVER.md) (not production hosts like mareades)

## Quick start (local, mock)

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
cp .env.example .env.local
```

In `.env.local`:

```env
SESSION_SECRET=a-long-random-string-at-least-16-characters
VIRTUALMIN_MOCK=true
```

```bash
npm install
npm run dev
```

Open http://localhost:3000 — on first start, `data/users.json` is created from `data/users.example.json`:

| User | Default password | Role |
|------|------------------|------|
| `admin` | `changeme` | administrator |
| `klant` | `changeme` | client (mock: `voorbeeld.nl`) |

**Change these passwords** before you share or deploy anything:

```bash
node scripts/hash-password.mjs your-password
```

## Production (real VirtualMin)

Deploy the panel at **https://qadbak.com** (see [deploy/nginx-qadbak.conf](deploy/nginx-qadbak.conf)).

1. `.env.local` on the server (do not commit) — see [.env.example](.env.example).
2. `VIRTUALMIN_MOCK=false`
3. `VIRTUALMIN_URL`, `VIRTUALMIN_USER`, `VIRTUALMIN_PASS` (often `127.0.0.1:10000` when Qadbak and VirtualMin share a VPS)
4. `WEBMIN_UI_URL` / `USERMIN_UI_URL` — public URLs of Webmin/Usermin on your host (server hostname, not necessarily qadbak.com)
5. API test: `npm run test-api`
6. Build: `npm run build && npm run start`
7. Nginx + TLS for `qadbak.com`: [deploy/nginx-qadbak.conf](deploy/nginx-qadbak.conf)

For self-signed TLS on port 10000: prefer a valid certificate; otherwise temporarily `NODE_TLS_REJECT_UNAUTHORIZED=0` (testing only).

## Marketing site (qadbak.com)

Static landing page matching the Qadbak panel UI — upload to your web root:

```bash
bash scripts/build-marketing-zip.sh
```

Output: **`dist/qadbak-site-upload.zip`** (extract and upload; see `marketing-site/README-UPLOAD.txt`).

## Documentation

| File | Contents |
|------|----------|
| [docs/STATUS.md](docs/STATUS.md) | Current phase — what’s done vs test VPS |
| [docs/V1-TEST-SERVER.md](docs/V1-TEST-SERVER.md) | **Start here:** step-by-step v1 test server |
| [docs/E2E-CHECKLIST.md](docs/E2E-CHECKLIST.md) | v1 sign-off after install |
| [docs/PHASES.md](docs/PHASES.md) | Integration phases and API routes |
| [docs/API.md](docs/API.md) | MVP VirtualMin commands |
| [docs/TEST-VPS.md](docs/TEST-VPS.md) | Short test VPS notes |
| [docs/FRONT-DOOR.md](docs/FRONT-DOOR.md) | IP/443 → Qadbak, not :10000 |
| [docs/ABOUT-THE-NAME.md](docs/ABOUT-THE-NAME.md) | Why “Qadbak” (2009 → panel) |

## Integration phases (overview)

| Phase | Scope |
|-------|--------|
| 1–2 | Domains, email, DB, DNS, SSL, aliases, redirects, backups |
| 3 | Files (Qadbak mock / Webmin live), logs, PHP, protected directories |
| 4–6 | Lifecycle, scripts, cron, extended mail, FTP |
| 7–8 | Server/reseller admin, cloud S3, system config |

Active phase: `IMPLEMENTED_PHASE` in `src/lib/features.ts`. In-app overview: `/fases`.

## Architecture

```
Browser → https://your-server or http://SERVER_IP  (ports 80/443)
              ↓ nginx
         Qadbak (Next.js, auth, RBAC, English UI)
              ↓ server-side only
         virtualmin.ts → remote.cgi
              ↓
         VirtualMin / Webmin on 127.0.0.1:10000 (not the public homepage)
```

End users should **not** land on `:10000` first — that is the classic Webmin UI. Qadbak is the front door. Details: [docs/FRONT-DOOR.md](docs/FRONT-DOOR.md).

- **Auth:** JWT (httpOnly), users in `data/users.json` (local, not in git)
- **RBAC:** `src/lib/rbac.ts` + `src/lib/features.ts`
- **Webmin:** `src/lib/webmin.ts` — `create-login-link` (root / domain / Usermin)
- **Audit:** `data/audit.log`

## Project structure

```
src/app/          Next.js routes (UI + API)
src/lib/          virtualmin, webmin, rbac, auth
src/components/   UI per domain / admin
data/             users.example.json (template), users.json (local)
deploy/           nginx example
docs/             phases, API, test VPS
scripts/          test-api, hash-password
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test-api` | Remote API connectivity (Phase 0) |

## License

**All Rights Reserved.** This repository is public for transparency and reference only. You may not use, copy, modify, or distribute the code without written permission from the copyright holder. See [LICENSE](LICENSE).
