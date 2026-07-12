# Qadbak native install (phase 6)

Fresh **Ubuntu or Debian** VPS **without** a legacy GPL control panel on the same machine.

**Supported:** Ubuntu 22.04/24.04/26.04 LTS, Debian 12 — see [LINUX-SUPPORT.md](./LINUX-SUPPORT.md).

## When to use

| Scenario | Installer |
|----------|-----------|
| New VPS, Qadbak-first (full stack) | `sudo bash install/qadbak-install.sh` |
| Panel UI only (mock or remote API) | `sudo bash install/qadbak-install-panel.sh` |
| Existing VPS with legacy panel | [MIGRATE-FROM-LEGACY-HOSTING.md](./MIGRATE-FROM-LEGACY-HOSTING.md) |
| Import domains from remote API | Set `QADBAK_LEGACY_API_URL` in `.env.local` (hybrid only) |

## Install

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh
```

The installer asks for:

- Panel hostname (FQDN)
- **Mail hostname** (MX / IMAP — usually your server FQDN or `mail.example.com`)
- Public IP (for DNS hints)

## What gets installed

- nginx, Apache (127.0.0.1:8080), MariaDB, Postfix, Dovecot, BIND9, PHP-FPM
- Qadbak panel + pm2 + native provisioning (send **and receive** mail)
- Postfix virtual domains + Maildir delivery + Dovecot IMAP
- **No** server admin on port 10000

## Mail (send + receive)

After install:

```bash
sudo bash scripts/test-mail-send.sh example.com info you@example.com
sudo bash scripts/test-mail-receive.sh example.com info
```

At your DNS provider (Cloudflare, etc.) — also shown in **Domains → Email**:

| Type | Name | Value |
|------|------|--------|
| MX | `@` | `10 mail.your-server-fqdn` |
| A | `mail` | your server IP (DNS only) |
| TXT | `@` | `v=spf1 mx a ip4:YOUR_IP ~all` |

Port **25** must be open (UFW + provider firewall).

## Provisioning domains

With `QADBAK_PROVISIONER=native` (default in installer):

- Create domains in the panel → `native-domains.json` + Postfix maps sync automatically
- `sudo bash scripts/run-provisioning-helper.sh mail-sync` — rebuild maps after manual edits

## PHP isolation (per customer)

Each domain unix user gets a dedicated PHP-FPM pool (`/run/php/qadbak-USER.sock`). Nginx serves `.php` via fastcgi under that user — not shared `www-data`.

```bash
sudo bash scripts/configure-php-fpm-sudo.sh
sudo bash scripts/apply-all-php-fpm-pools.sh   # existing domains
```

New domains: pool + nginx vhost are applied on create. Change PHP version in the panel → pool and vhost refresh automatically.

See [IMAP-NATIVE.md](./IMAP-NATIVE.md) and [MIGRATE-FROM-LEGACY-HOSTING.md](./MIGRATE-FROM-LEGACY-HOSTING.md).

## Post-install (customers)

After `install/qadbak-install.sh` finishes, verification runs automatically via `scripts/post-install-verify.sh` (API health + optional Playwright E2E).

| Task | Command |
|------|---------|
| Stay updated | `sudo bash /opt/qadbak/scripts/update-qadbak.sh` |
| Re-verify | `sudo bash /opt/qadbak/scripts/post-install-verify.sh` |
| Firewall (optional) | `sudo bash /opt/qadbak/scripts/configure-ufw-qadbak.sh` |
| Activate Premium later | `sudo bash /opt/qadbak/scripts/buy-premium.sh YOUR-KEY` |
| Panel fix (520 / down) | `sudo bash /opt/qadbak/scripts/fix-panel-now.sh` |

**Mail:** open **Domains → Email** for DNS records (MX, SPF, DKIM). Port **25** must be open at your provider and in UFW if you use it.

**iOS app (public beta):** needs HTTPS on the panel, Premium license (Qmail/webmail), and mobile API v1.1+. See [MOBILE-IOS-APP.md](./MOBILE-IOS-APP.md). TestFlight access: `support@inveil.net`.

**Manual QA:** [E2E-CHECKLIST.md](./E2E-CHECKLIST.md) — create a test domain, mailbox, and DNS record in the panel.
