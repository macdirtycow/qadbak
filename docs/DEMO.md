# Live demo panel (demo.qadbak.com)

Public read-only Qadbak instance so visitors can explore the real UI before installing.

## URLs

| URL | Purpose |
|-----|---------|
| `https://demo.qadbak.com/login` | Demo login (credentials prefilled) |
| `https://qadbak.com` | Marketing site + production panel |

## Default credentials

| Field | Value |
|-------|--------|
| Username | `demo` |
| Password | `DemoView2026!` (override with `QADBAK_DEMO_PASSWORD` in `.env.local`) |

The demo account is **admin** so all menus are visible. **Mutations are blocked** (POST/PUT/PATCH/DELETE on `/api/*`) with a clear error message.

**Terminal is disabled** on the public demo (including admin and domain shells). The demo user cannot obtain WebSocket tokens or open a real shell — even though the UI menus are visible.

**Explorable areas:** dashboard, domains (DNS, SSL, files), mail & newsletter, Site tools, **Media library**, app store, backups UI, server admin (Premium screens visible to demo admin).

Sample domain in the panel: `showcase.qadbak.com` (JSON config for Site tools / newsletter UI). Marked `demoOnly` in `native-domains.json` — **hidden from your real admin** on qadbak.com; the demo user only sees showcase domains, not customer sites.

## Enable on your VPS (qadbak.com server)

1. **DNS** — `A` record `demo.qadbak.com` → VPS public IP (Cloudflare proxy OK).

2. **Run setup** (as root, from `/opt/qadbak` after `git pull`):

```bash
sudo bash scripts/apply-demo-vhost.sh
```

This script:

- Sets `QADBAK_DEMO_HOST`, `QADBAK_DEMO_ENABLED`, `QADBAK_DEMO_READ_ONLY` in `.env.local`
- Expands Let's Encrypt cert to include `demo.qadbak.com`
- Re-applies nginx (`apply-hosting-nginx.sh` adds demo host to panel `server_name`)
- Seeds demo user + showcase config (`scripts/seed-demo-panel.mjs`)
- Runs `npm run build` and restarts pm2

3. **Optional** — create a real unix user for `showcase.qadbak.com` so file/mail actions work in demo:

```bash
sudo bash scripts/qadbak-add-domain.sh showcase.qadbak.com 'StrongPass!' showcase
```

Read-only mode still blocks writes from the demo login.

## Environment variables

```env
QADBAK_DEMO_HOST=demo.qadbak.com
QADBAK_DEMO_ENABLED=true
QADBAK_DEMO_READ_ONLY=true
QADBAK_DEMO_TERMINAL_DISABLED=true
QADBAK_DEMO_USERNAME=demo
QADBAK_DEMO_PASSWORD=DemoView2026!
QADBAK_DEMO_SHOWCASE_DOMAIN=showcase.qadbak.com
```

Set `QADBAK_DEMO_READ_ONLY=false` only on private sandboxes — not on the public internet.

## Marketing site

Landing copy and CTAs live in `marketing-site/index.html` (section `#demo`, hero “Try live demo”). Redeploy with:

```bash
cd /opt/qadbak && git pull && sudo -u qadbak npm run build
sudo bash scripts/pm2-restart-qadbak.sh
```

## Reseed demo data

```bash
sudo -u qadbak node /opt/qadbak/scripts/seed-demo-panel.mjs
```
