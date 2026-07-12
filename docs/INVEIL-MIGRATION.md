# Inveil rebrand — migration checklist

Qadbak is published by **Inveil** (replacing Omiiba). Product URLs stay on
**qadbak.com**; company site **inveil.net**; license server **license.inveil.dev**.

This repo already points at the new names. Complete these steps on infrastructure
outside git.

## 1. DNS (Cloudflare or registrar)

| Host | Points to |
|------|-----------|
| `inveil.net`, `www.inveil.net`, `inveil.dev` | **Main VPS** (e.g. `.158`) |
| `license.inveil.dev` | **License VPS** (e.g. `.80`) |
| `license.omiiba.dev` | License VPS → **301** to `license.inveil.dev` |
| `omiiba.dev` | Main VPS → **301** to `inveil.net` |

During first TLS setup, set Cloudflare proxy to **DNS only** (grey cloud) until certbot succeeds.

## 2. Email (@inveil.net)

Create or forward:

- `support@inveil.net`
- `legal@inveil.net`
- `privacy@inveil.net`
- `billing@inveil.net`
- `security@inveil.net`
- `info@inveil.net`

Keep `@omiiba.dev` aliases forwarding to `@inveil.net` during transition.

**Restore mail + webmail on main VPS** (forwards `@inveil.net` → `@omiiba.dev`):

```bash
cd /opt/qadbak && git pull
sudo bash scripts/restore-inveil-mail.sh
```

Prints Cloudflare MX/SPF/DKIM records. Webmail login uses `@omiiba.dev` mailboxes.

## 3. Two-server layout (recommended)

**License VPS** (IP ending `.80`, vmi2930777):

```bash
sudo INVEIL_MIGRATION_SCOPE=license bash /opt/qadbak-premium/ops/migrate-to-inveil.sh
```

**Main VPS** (IP ending `.158`) — only `/opt/qadbak` needed:

```bash
cd /opt/qadbak && git pull
sudo bash inveil-site/ops/migrate-site.sh
```

**License VPS** (IP ending `.80`):

```bash
sudo INVEIL_MIGRATION_SCOPE=license bash /opt/qadbak-premium/ops/migrate-to-inveil.sh
```

Each scope only configures nginx/certs for hosts on that box. Do **not** run the full
migrate on the license server if `inveil.net` DNS points elsewhere.

Single-box (everything on one host): `INVEIL_MIGRATION_SCOPE=all`

Dry run: `sudo DRY_RUN=1 INVEIL_MIGRATION_SCOPE=license bash ...`

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
