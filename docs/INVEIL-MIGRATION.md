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

**One command** (after `qadbak-premium` is cloned to `/opt/qadbak-premium`):

```bash
sudo bash /opt/qadbak-premium/ops/migrate-to-inveil.sh
```

This script:

1. Pulls latest `qadbak-premium` (includes `inveil-site/`)
2. Updates `/etc/qadbak/license-server.env` → `license.inveil.dev` + `@inveil.net` mail
3. Deploys **inveil.net** static site to `/var/www/inveil.net`
4. Configures nginx for `license.inveil.dev`, `inveil.net`, `inveil.dev`, and **301 redirects** from `omiiba.dev` / `license.omiiba.dev`
5. Restarts the license server (pm2)

Dry run: `sudo DRY_RUN=1 bash /opt/qadbak-premium/ops/migrate-to-inveil.sh`

Manual steps (if needed):

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
