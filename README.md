# Nexmin

**Nexmin** is a modern English UI layer **on top of** [VirtualMin](https://virtualmin.com) / Webmin — not a fork. Domains, email, databases, DNS, SSL, server management, and Webmin login links with role-based access (admin / client).

> **Status:** Work in progress — UI phases 1–8 are implemented; production testing on a separate VPS is planned.

## Requirements

- Node.js 20+
- VirtualMin with Remote API (`remote.cgi`) for production
- Optional: dedicated VPS for testing only ([docs/TEST-VPS.md](docs/TEST-VPS.md))

## Quick start (local, mock)

```bash
git clone <your-private-repo-url>
cd nexmin
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

1. `.env.local` on the server (do not commit) — see [.env.example](.env.example).
2. `VIRTUALMIN_MOCK=false`
3. `VIRTUALMIN_URL`, `VIRTUALMIN_USER`, `VIRTUALMIN_PASS`
4. `WEBMIN_UI_URL` / `USERMIN_UI_URL` for Webmin/Usermin links
5. API test: `npm run test-api`
6. Build: `npm run build && npm run start`
7. Reverse proxy: [deploy/nginx-nexmin.conf](deploy/nginx-nexmin.conf)

For self-signed TLS on port 10000: prefer a valid certificate; otherwise temporarily `NODE_TLS_REJECT_UNAUTHORIZED=0` (testing only).

## Documentation

| File | Contents |
|------|----------|
| [docs/PHASES.md](docs/PHASES.md) | Integration phases and API routes |
| [docs/API.md](docs/API.md) | MVP VirtualMin commands |
| [docs/TEST-VPS.md](docs/TEST-VPS.md) | Testing on a separate VPS |

## Integration phases (overview)

| Phase | Scope |
|-------|--------|
| 1–2 | Domains, email, DB, DNS, SSL, aliases, redirects, backups |
| 3 | Files (Nexmin mock / Webmin live), logs, PHP, protected directories |
| 4–6 | Lifecycle, scripts, cron, extended mail, FTP |
| 7–8 | Server/reseller admin, cloud S3, system config |

Active phase: `IMPLEMENTED_PHASE` in `src/lib/features.ts`. In-app overview: `/fases`.

## Architecture

```
Browser → Nexmin (Next.js, auth, RBAC, English UI)
              ↓ server-side only
         virtualmin.ts → remote.cgi
              ↓
         VirtualMin / Webmin on host :10000
```

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

Private project — no public distribution unless you choose otherwise later.
