# Qadbak commercial tiers and VPS migration

Copyright (c) 2026 MacDirtyCow / Qadbak and Omiiba. See [LICENSE](../LICENSE).

## Tiers

| Tier | Source | Use |
|------|--------|-----|
| **Core (public GitHub)** | `macdirtycow/qadbak` | Transparency, auditing, personal evaluation on **your own** VPS |
| **Premium (private)** | `qadbak-premium` repo | Multi-tenant clients, admin updates, PHP-FPM isolation, panel vhost, dashboard pm2 control |
| **Licensed runtime** | Core + signed Premium bundle | Production commercial installs |

Public `git clone` gives **Core only**. Premium API routes return `503 PREMIUM_REQUIRED` until a license is activated and modules are synced.

## Your VPS (siccamanagement.nl)

Until customers use the public eval build, run a **private Core + Premium** stack:

1. Clone **public** qadbak to `/opt/qadbak` (Core updates via `git pull`).
2. Keep **qadbak-premium** on the server (or CI) — build with `npm run build:release`.
3. Deploy license server or use `license.omiiba.com`.
4. Set in `/opt/qadbak/.env.local`:

```env
QADBAK_LICENSE_SERVER=https://license.omiiba.com
QADBAK_LICENSE_JWT_SECRET=<same as license server LICENSE_JWT_SECRET>
```

5. **Server admin → License** → activate key → **Refresh modules**.
6. Daily heartbeat: install `scripts/license-heartbeat.sh` via cron or systemd timer.

```bash
# Example cron (as qadbak user)
0 4 * * * /opt/qadbak/scripts/license-heartbeat.sh >> /opt/qadbak/data/license-heartbeat.log 2>&1
```

After each Core update:

```bash
cd /opt/qadbak && sudo bash scripts/update-qadbak.sh
node scripts/qadbak-license-cli.mjs sync
```

Rebuild Premium when the private repo changes, upload artifact to the license server, then **Refresh modules** in the panel.

## What eval users may not do

- Host paying customers without a commercial license
- Redistribute Premium bundles or remove license checks
- Fork and operate a competing hosted panel

See [COMMERCIAL-LICENSING.md](../COMMERCIAL-LICENSING.md).

## Legal

This document is operational guidance, not legal advice. Consult an attorney for NL/EU commercial sales, VAT, and customer agreements.
