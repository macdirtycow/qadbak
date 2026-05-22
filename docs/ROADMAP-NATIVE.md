# Qadbak native integration roadmap

Goal: manage hosting from **Qadbak only** — VirtualMin/Webmin run on the server, but users rarely need `:10000`.

## Done

| Area | Status |
|------|--------|
| Remote API | `multiline` only on `list-*`; `simple-multiline` elsewhere |
| Files | Native browser (`domain-fs-helper.mjs`) + filemin embed fallback |
| Upload / download | Live via helper (`write-bytes`, read) |
| Website / Cloudflare 523 | Health card + `fix-domain-website.sh` |
| Email mailboxes | `list-users` / `create-user` / `modify-user` / `delete-user` (native API) |

## Phase A — DNS, cron, mail (this release)

| Area | Implementation |
|------|----------------|
| DNS | `get-dns` with `multiline`; add via `--add-record` / `--add-record-with-ttl`; delete via `--remove-record` |
| Cron | `run-api-command` + `list-cron` flags; fallback `crontab -l` via helper |
| Mail | `create-user` with `mail=1` |

Still **no Webmin UI** for these tabs.

## Phase B — Next

| Area | Plan |
|------|------|
| DNS | Edit record, SPF/DKIM toggles (`modify-dns --spf`, `--enable-dkim`) |
| Cron | Native create/delete via helper or verified `create-cron` API |
| SSL | Full native Let's Encrypt flow in panel |
| Databases | Connection strings + phpMyAdmin-free management |
| Logs | Tail `access_log` / `error_log` via helper |

## Phase C — Remaining embeds → native

| Current embed | Target |
|---------------|--------|
| Terminal | SSH keys / limited command whitelist (or keep embed, admin-only) |
| Webmin module browser | Retire per-module as API coverage completes |

## Server setup after pull

```bash
cd /opt/qadbak && git pull
sudo bash scripts/configure-domain-fs-sudo.sh
sudo bash scripts/configure-domain-repair-sudo.sh
sudo -u qadbak bash -c 'cd /opt/qadbak && npm run build && pm2 restart qadbak'
```

Set in `.env.local`:

```env
QADBAK_ORIGIN_IP=YOUR_CONTABO_PUBLIC_IP
```
