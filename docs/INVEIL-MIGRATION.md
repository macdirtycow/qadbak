# Inveil rebrand — migration checklist

Qadbak is published by **Inveil** (replacing Omiiba). Product URLs stay on
**qadbak.com**; company site **inveil.net**; license server **license.inveil.dev**.

This repo already points at the new names. Complete these steps on infrastructure
outside git.

## 1. DNS (Cloudflare or registrar)

| Host | Purpose |
|------|---------|
| `inveil.net` | Company site (can redirect to qadbak.com or a simple landing) |
| `www.inveil.net` | Same |
| `inveil.dev` | Developer / redirect to inveil.net |
| `license.inveil.dev` | License server (A/AAAA to license VPS) |
| `license.omiiba.dev` | **301 redirect** → `https://license.inveil.dev` (keep 6–12 months) |
| `omiiba.dev` | **301 redirect** → `https://inveil.net` |

## 2. Email (@inveil.net)

Create or forward:

- `support@inveil.net`
- `legal@inveil.net`
- `privacy@inveil.net`
- `billing@inveil.net`
- `security@inveil.net`
- `info@inveil.net`

Keep `@omiiba.dev` aliases forwarding to `@inveil.net` during transition.

## 3. License server VPS

On the machine that runs the license server (private `qadbak-premium` or equivalent):

1. TLS certificate for `license.inveil.dev`
2. Nginx/server vhost: `server_name license.inveil.dev;`
3. Env / config: public URL `https://license.inveil.dev`
4. Stripe Checkout success/cancel URLs → `license.inveil.dev`
5. Stripe webhook endpoint URL updated in Stripe Dashboard
6. Admin UI reachable at `https://license.inveil.dev/admin`
7. Smoke test: `curl -sf https://license.inveil.dev/health`

Existing license keys and JWT secrets **unchanged** — only hostname moves.

## 4. Customer panels (already installed)

On each Qadbak VPS:

```bash
# /opt/qadbak/.env.local
QADBAK_LICENSE_SERVER=https://license.inveil.dev
```

Then:

```bash
cd /opt/qadbak && sudo bash scripts/update-qadbak.sh
sudo -u qadbak node scripts/qadbak-license-cli.mjs heartbeat
```

New installs pick up `license.inveil.dev` from `install/qadbak-install.sh` automatically.

## 5. qadbak.com marketing site

After merging this rebrand:

```bash
cd /opt/qadbak && git pull && sudo -u qadbak npm run build
sudo bash scripts/pm2-restart-qadbak.sh
```

Or upload a fresh `scripts/build-marketing-zip.sh` bundle if the site is static-only.

## 6. GitHub

```bash
bash scripts/sync-github-repo-about.sh
```

Update org/profile description to mention Inveil if desired.

## 7. iOS / App Store

- Rebuild IPA after pull (`bash ios/scripts/build-ipa.sh`)
- App Store Connect: seller/support URLs → inveil.net / support@inveil.net
- “Support Qadbak” link in app already uses `license.inveil.dev/buy`

## 8. Legal pages

Terms, privacy, and refund on qadbak.com reference Inveil and `@inveil.net`.
Bump “last updated” dates when you publish to production.

## Quick verify

```bash
curl -sf https://license.inveil.dev/health
curl -sI https://license.omiiba.dev/health | head -3   # expect 301 to inveil.dev
grep QADBAK_LICENSE_SERVER /opt/qadbak/.env.local
```
