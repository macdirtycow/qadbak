# Native IMAP (Dovecot, no VirtualMin)

The **IMAP** tab lists mail folders, message counts, **reads mail**, and can **send mail** via Postfix using **[Dovecot](https://www.dovecot.org/)** and on-disk **Maildir**.

## How it works

```
Qadbak panel → provisioning-helper → doveadm + Maildir scan
                                      ↓
                              Dovecot user db / Maildir
```

| Operation | Helper command |
|-----------|----------------|
| List folders + counts | `imap-list` |
| List messages in folder | `imap-messages` |
| Read one message | `imap-fetch` |
| Copy folder (admin) | `imap-copy` |
| Send message | `mail-send` |
| Sync maps / diagnose | `mail-sync`, `mail-diagnose`, `mail-receive-test` |

Folder **messages** and **size** use `doveadm mailbox status` per folder (Dovecot 2.3-friendly), with Maildir counts when doveadm returns empty values.

Message list and body are read from **Maildir** (`cur`/`new`) when possible; doveadm fetch is used as a fallback.

Auth user resolution tries, in order:

- `local@domain` (e.g. `info@example.com`)
- Unix user `local` or domain owner
- Accounts from Postfix virtual maps + `~/homes/*` (same as **Email** tab)

## Requirements

- `dovecot-core` + `dovecot-imapd` (see `scripts/install-native-stack.sh`)
- `QADBAK_MAIL_BACKEND=direct` (default in independent mode)
- `QADBAK_NATIVE_FEATURES` includes `imap`

## VPS checks

```bash
cd /opt/qadbak
git pull
sudo bash scripts/configure-native-mail.sh
sudo bash scripts/run-provisioning-helper.sh mail-sync
sudo bash scripts/check-native-mail.sh YOUR-DOMAIN info
sudo bash scripts/check-imap-dovecot.sh YOUR-DOMAIN info

sudo bash scripts/test-mail-send.sh YOUR-DOMAIN info you@gmail.com
sudo bash scripts/test-mail-receive.sh YOUR-DOMAIN info
```

**Incoming mail** requires an **MX record** for the domain pointing to this server, and port **25** open in the firewall.

**Outgoing mail** uses Postfix on this host; many providers require **SPF/DKIM** DNS records to avoid spam folders (see **Mail security** per domain).

Panel: **Domains → IMAP** → pick user → **Load folders** → read mail, or use **Send email**.

## Related

- Mail accounts: native `mail` module (`provision-mail.mjs`, Postfix maps)
- [TERMINAL-NATIVE.md](./TERMINAL-NATIVE.md), [PHASE-8-INDEPENDENT.md](./PHASE-8-INDEPENDENT.md)
