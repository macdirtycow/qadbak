# Production hardening

Security and scalability notes for moving from a test VPS to production.

## 1. User storage (`data/users.json`)

### Current behaviour

| Item | Implementation |
|------|----------------|
| Panel users | `data/users.json` (local file, not in git) |
| Sessions | JWT in httpOnly cookies (`SESSION_SECRET`) — **not** stored in JSON |
| App writes | Install script seeds the file; runtime code **reads only** (in-memory cache) |

Risks today are moderate: a few admins, rare manual edits, single Node process. There is **no** file locking because the app does not write users at runtime yet.

### When JSON becomes a problem

- Admin UI that creates/edits users concurrently
- Multiple pm2 instances / cluster workers
- Large customer counts (slow full-file parse, no indexes)

### Recommended path: SQLite

Stay standalone (one file on disk, e.g. `data/qadbak.db`), but use a proper store:

- **Drizzle ORM** + `better-sqlite3` (simple, sync-friendly on one VPS), or
- **Prisma** + SQLite (migrations, familiar DX)

Suggested schema (minimal):

- `users` — id, username, password_hash, role, created_at
- `user_domains` — user_id, domain (for RBAC)
- Optional later: `audit_log` rows instead of append-only JSON logs

Migration steps:

1. Add DB layer behind `src/lib/users.ts` (same `PanelUser` API).
2. Ship `scripts/migrate-users-json-to-sqlite.ts` for existing servers.
3. Keep `users.json` as fallback one release, then remove.

Until then: treat `users.json` as **infrastructure config** (edit on server, backup with VPS).

## 2. TLS to VirtualMin (`:10000`)

### Problem

`NODE_TLS_REJECT_UNAUTHORIZED=0` in `.env.local` disables certificate verification for **every** HTTPS call from the Node process (updates, webhooks, any future external API).

### Fix in this repo

Qadbak uses a **scoped** opt-in:

```env
# Only for self-signed Webmin on 127.0.0.1:10000 — not global TLS disable
# (auto-enabled when VIRTUALMIN_URL uses localhost / 127.0.0.1)
VIRTUALMIN_TLS_INSECURE=true
```

Implementation: `src/lib/virtualmin-http.ts` passes an Undici `Agent` with `rejectUnauthorized: false` only to `virtualMinFetch()` (remote.cgi).

### Better long-term

1. **Let's Encrypt on Webmin** for the server FQDN (or internal CA), then remove `VIRTUALMIN_TLS_INSECURE`.
2. Or set `VIRTUALMIN_URL=https://127.0.0.1:10000/...` with a pinned CA file (future: `VIRTUALMIN_CA_FILE`).

### Install / upgrade

Replace in `.env.local`:

```diff
-NODE_TLS_REJECT_UNAUTHORIZED=0
+VIRTUALMIN_TLS_INSECURE=true
```

New installs should not set the global variable.

## Checklist before production

- [ ] Change default passwords; rotate `SESSION_SECRET`
- [ ] `VIRTUALMIN_TLS_INSECURE` only if needed; plan proper Webmin TLS
- [ ] Bind Webmin to `127.0.0.1` if the panel is the only public UI
- [ ] Plan SQLite when adding user management in the UI
- [ ] Backups: `data/users.json` (or future `.db`), `.env.local`, VirtualMin config
