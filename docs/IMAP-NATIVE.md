# Native IMAP (Dovecot, no VirtualMin)

The **IMAP** tab lists mail folders and message counts using **[Dovecot](https://www.dovecot.org/)** — the standard open-source IMAP server used with Postfix on this stack.

## How it works

```
Qadbak panel → provisioning-helper → doveadm (as root)
                                      ↓
                              Dovecot user db / Maildir
```

| Operation | Command |
|-----------|---------|
| List folders | `doveadm -f tab mailbox list -u USER` |
| Messages + size | `doveadm -f tab mailbox status -u USER messages vsize ALL` |
| Copy folder | `doveadm mailbox copy -u USER "INBOX" "Archive"` |

Auth user resolution tries, in order:

- `local@domain` (e.g. `info@siccamanagement.nl`)
- Unix user `local` or domain owner
- Accounts from Postfix virtual maps + `~/homes/*` (same as **Email** tab)

If `doveadm` is missing, the helper falls back to scanning **Maildir** on disk.

## Requirements

- `dovecot-core` + `dovecot-imapd` (see `scripts/install-native-stack.sh`)
- `QADBAK_MAIL_BACKEND=direct` (default in independent mode)
- `QADBAK_NATIVE_FEATURES` includes `imap`

## VPS checks

```bash
cd /opt/qadbak
sudo bash scripts/pull-and-helpers.sh
sudo bash scripts/apply-phase8-independent.sh   # ensures imap in native features
sudo bash scripts/check-imap-dovecot.sh siccamanagement.nl info
# Version check: doveadm -V  (not --version on Dovecot 2.3)
```

Panel: **Domains → IMAP** → pick mailbox user → **Load folders**. Source badge should show **Dovecot (doveadm)**.

## Copy mailbox

Admin-only: copies between **folder names** (not file paths), e.g. `INBOX` → `Archive`.

## Related

- Mail accounts: native `mail` module (`provision-mail.mjs`, Postfix maps)
- [TERMINAL-NATIVE.md](./TERMINAL-NATIVE.md), [PHASE-8-INDEPENDENT.md](./PHASE-8-INDEPENDENT.md)
