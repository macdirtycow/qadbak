# Native IMAP (Dovecot, no VirtualMin)

The **IMAP** tab lists mail folders, message counts, and lets you **read mail** using **[Dovecot](https://www.dovecot.org/)** and on-disk **Maildir**.

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

Folder **messages** and **size** use `doveadm mailbox status` per folder (Dovecot 2.3-friendly), with Maildir counts when doveadm returns empty values.

Message list and body are read from **Maildir** (`cur`/`new`) when possible; doveadm fetch is used as a fallback.

Auth user resolution tries, in order:

- `local@domain` (e.g. `info@siccamanagement.nl`)
- Unix user `local` or domain owner
- Accounts from Postfix virtual maps + `~/homes/*` (same as **Email** tab)

## Requirements

- `dovecot-core` + `dovecot-imapd` (see `scripts/install-native-stack.sh`)
- `QADBAK_MAIL_BACKEND=direct` (default in independent mode)
- `QADBAK_NATIVE_FEATURES` includes `imap`

## VPS checks

```bash
cd /opt/qadbak
sudo bash scripts/pull-and-helpers.sh
sudo bash scripts/apply-phase8-independent.sh
sudo bash scripts/check-imap-dovecot.sh siccamanagement.nl info
# Version: doveadm -V  (not --version on Dovecot 2.3)

# CLI smoke (messages in INBOX)
sudo node scripts/provisioning-helper.mjs imap-messages siccamanagement.nl info INBOX
```

Panel: **Domains → IMAP** → pick user → **Load folders** → click folder → click message.

## Related

- Mail accounts: native `mail` module (`provision-mail.mjs`, Postfix maps)
- [TERMINAL-NATIVE.md](./TERMINAL-NATIVE.md), [PHASE-8-INDEPENDENT.md](./PHASE-8-INDEPENDENT.md)
