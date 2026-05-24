# Qadbak native install (phase 6)

Fresh Ubuntu VPS **without** a legacy GPL control panel on the same machine.

## When to use

| Scenario | Installer |
|----------|-----------|
| New VPS, Qadbak-first | `sudo bash install/qadbak-install.sh` |
| Existing VPS with legacy panel | [MIGRATE-FROM-VIRTUALMIN.md](./MIGRATE-FROM-VIRTUALMIN.md) |
| Import domains from remote API | Set `VIRTUALMIN_URL` in `.env.local` (hybrid only) |

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
- **No** Webmin on port 10000

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
- `sudo bash scripts/run-provisioning-helper.sh mail-sync` — rebuild maps after manual changes

See [IMAP-NATIVE.md](./IMAP-NATIVE.md) and [MIGRATE-FROM-VIRTUALMIN.md](./MIGRATE-FROM-VIRTUALMIN.md).
