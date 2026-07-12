# Qadbak product roadmap

Full UI replacement of server admin/legacy hosting. Product name: **Qadbak** (repo: `macdirtycow/qadbak`).

**Independence plan (8 phases, Dutch):** [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md) — how Qadbak stands alone without server admin in daily use, and eventually without legacy hosting API on the server.

See [PARITY-AUDIT.md](./PARITY-AUDIT.md) for per-menu status.

## Phases (product)

| Phase | Goal | User-visible outcome |
|-------|------|----------------------|
| **0** | Deploy baseline | Panel live on VPS with real legacy hosting API API |
| **1** | Parity docs | Checklist for every menu item |
| **2** | **v1** legacy hosting native | Hosting without leaving panel for VM tasks |
| **3** | Rebrand | Product name Qadbak everywhere |
| **4** | Installer | `install/qadbak-install.sh` on Ubuntu 22.04 |
| **5** | **v2** System | Dashboard + System menu in panel |
| **6** | **v3** Servers | Apache, mail stack, BIND, … in panel |
| **7** | **v4–v5** | Tools, Networking, Hardware, Cluster |

## Independence phases (engine)

| Phase | Summary |
|-------|---------|
| **I1** | No server admin UI for customers — native files, terminal, API screens |
| **I2** | Provisioner abstraction ✅ — [PROVISIONER.md](./PROVISIONER.md) |
| **I3** | Full hosting UI; VM API headless only |
| **I4** | Server/reseller admin without server admin |
| **I5** | Config via scripts/helpers (Hestia-style) |
| **I6** | Install without legacy hosting API installer |
| **I7** | Multi-server (optional) |
| **I8** | Remove legacy hosting API package |

Details: [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md).

## v1 scope (Phase 2)

Native or in-panel for:

- All [DOMAIN_FEATURES](../src/lib/features.ts) routes
- legacy hosting sidebar items (summary, sub/alias create, files, terminal, scripts)
- Admin: server, resellers, plans, system, cloud, license

## v2+ strategy

Until each server admin module has a rebuilt form, use **in-panel embed** (`LegacyPanelEmbed`) with `create-login-link` — same chrome as Qadbak, no password in browser. Replace with native UI module-by-module.

## Timeline (estimate)

| Phase | Duration |
|-------|----------|
| 0–1 | days |
| 2 v1 | 4–12 weeks |
| 3–4 | ~1 week |
| 5 v2 | 6–10 weeks |
| 6 v3 | 2–4 months |
| 7 v4–v5 | 2–4+ months |

## Links

- [ROADMAP.md](./ROADMAP.md) — product direction
- [V1-TEST-SERVER.md](./V1-TEST-SERVER.md) — **v1 test VPS (start here)**
- [E2E-CHECKLIST.md](./E2E-CHECKLIST.md) — v1 sign-off
- [DEPLOY.md](./DEPLOY.md) — production setup (after test VPS passes)
- [TEST-VPS.md](./TEST-VPS.md) — short test server notes
- [PHASES.md](./PHASES.md) — legacy hosting API API integration phases
