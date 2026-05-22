# Integration phases — Qadbak

Full VirtualMin coverage is delivered in phases. Each phase adds API programs to RBAC (`src/lib/features.ts`) and UI under `/domains/[domain]/…`.

**Status:** Phases 1–8 ✅

---

## Phase 1 — Core (complete)

| Area | VirtualMin API | Qadbak route |
|------|----------------|-------------|
| Domain overview | `list-domains` | `/domains` |
| Enable / disable domain | `enable-domain`, `disable-domain` | detail |
| Email mailboxes | `list-users`, `create-user`, `modify-user`, `delete-user` | `/domains/…/email` |
| Databases | `list-databases`, `create-database`, `modify-database-pass` | `/domains/…/databases` |
| VirtualMin deep link | `create-login-link` | detail |

---

## Phase 2 — DNS, SSL, aliases, redirects, backups (complete)

| Area | API | Route |
|------|-----|-------|
| View / edit DNS | `get-dns`, `modify-dns` | `/domains/…/dns` |
| SSL certificates | `list-certs`, `list-certs-expiry`, `generate-letsencrypt-cert` | `/domains/…/ssl` |
| Email aliases | `list-aliases`, `list-simple-aliases`, `create-simple-alias`, `delete-alias` | `/domains/…/aliases` |
| URL redirects | `list-redirects`, `create-redirect`, `delete-redirect` | `/domains/…/redirects` |
| Backups | `backup-domain`, `list-scheduled-backups` | `/domains/…/backups` |

---

## Phase 3 — Website & PHP (complete)

| Area | API | Route |
|------|-----|-------|
| Files (public_html) | Native: `domain-fs-helper.mjs` (sudo); fallback: `create-login-link` → filemin; mock: Qadbak browser | `/domains/…/files` |

### Live server — Files (2026-05)

1. **Remote API:** `simple-multiline` on non-`list-*` calls (fixes `Unknown parameter --multiline` on `create-login-link` and embeds).
2. **Native browser:** `scripts/domain-fs-helper.mjs` + sudoers (`configure-domain-fs-sudo.sh`) lists/edits files under `/home/`.
3. **Fallback:** Webmin filemin embed when sudo helper is unavailable.

---
| Webmin & Usermin | `create-login-link` (root / domain / usermin-user) | `/admin/webmin`, `/domains/…/webmin` |
| Website logs | `get-logs` | `/domains/…/logs` |
| PHP per directory | `list-php-versions`, `list-php-directories`, `set-php-directory`, `delete-php-directory` | `/domains/…/php` |
| PHP.ini | `list-php-ini`, `modify-php-ini` | `/domains/…/php` |
| Protected directories | `list-protected-directories`, `create-protected-directory`, `delete-protected-directory` | `/domains/…/protected` |
| Directory passwords | `list-protected-users`, `create-protected-user`, `delete-protected-user` | `/domains/…/protected` |
| Spam & DKIM | `set-spam`, `set-dkim` | `/domains/…/security` |

---

## Phase 4 — Domain lifecycle (admin, complete)

| Area | API | Route |
|------|-----|-------|
| New domain | `create-domain` | `/domains/new` |
| Subdomain / alias | `create-domain` (flags) | `/domains/new` |
| Features | `list-features`, `enable-feature`, `disable-feature` | `/domains/…/features` |
| Limits | `modify-limits`, `modify-resources` | `/domains/…/limits` |
| Lifecycle | `delete-domain`, `clone-domain`, `migrate-domain`, `transfer-domain`, `validate-domains` | `/domains/…/lifecycle` |
| Server check | `check-config` | dashboard (admin) |

---

## Phase 5 — Scripts & proxies (complete)

| Area | API | Route |
|------|-----|-------|
| Script installers | `list-available-scripts`, `install-script`, `delete-script`, `list-scripts` | `/domains/…/scripts` |
| Proxies | `list-proxies`, `create-proxy`, `delete-proxy` | `/domains/…/proxies` |
| Cron | `list-cron-jobs`, `create-cron-job`, `delete-cron-job` (→ `run-api-command`) | `/domains/…/cron` |

---

## Phase 6 — Extended mail & FTP (complete)

| Area | API | Route |
|------|-----|-------|
| IMAP mailboxes | `list-mailbox`, `copy-mailbox` | `/domains/…/mailboxes` |
| Mail logs | `search-maillogs`, `resend-email` | `/domains/…/mail-logs` |
| Catch-all / autoresponder | `modify-mail` | `/domains/…/mail-settings` |
| FTP accounts | `create-user`, `modify-user`, `delete-user` (ftp=1) | `/domains/…/ftp` |
| Shared addresses | `list-shared-addresses`, `create-shared-address`, `delete-shared-address` | `/domains/…/shared` |

---

## Phase 7 — Server & reseller (admin only, complete)

| Area | API | Route |
|------|-----|-------|
| Bandwidth | `list-bandwidth` | `/admin/server` |
| Server status | `list-server-statuses`, `restart-server` | `/admin/server` |
| Resellers | `list-resellers`, `create-reseller`, `delete-reseller` | `/admin/resellers` |
| Plans | `list-plans`, `create-plan`, `delete-plan` | `/admin/plans` |
| Templates | `list-templates`, `get-template` | `/admin/templates` |
| Extra admins | `list-admins`, `create-admin`, `delete-admin` | `/admin/admins` |
| License | `license-info` | `/admin/license` |

`modify-reseller`, `modify-plan`, `modify-template`, and `setup-repos` are in RBAC; changes via VirtualMin or a future UI.

---

## Phase 8 — Cloud backups & advanced (complete)

| Area | API | Route |
|------|-----|-------|
| Schedule on/off | `modify-scheduled-backup` | `/domains/…/backups` |
| Restore | `restore-domain` | `/domains/…/backups` (restore) |
| S3 buckets & files | `list-s3-buckets`, `list-s3-files` | `/admin/cloud` |
| S3 upload | `upload-s3-file` | `/admin/cloud` |
| Global features | `set-global-feature`, `list-global-features` | `/admin/system` |
| System bundle | `config-system` | `/admin/system` |

`list-global-features` is a Qadbak helper (mock); on real servers the feature list may differ.

---

## Design rules (all phases)

1. **No direct `remote.cgi` in the browser** — everything goes through the Qadbak API + RBAC.
2. **Client = domain-scoped** — same UI, fewer programs in the allowlist.
3. **Unknown / complex actions** — “Open in VirtualMin” button.
4. **Mock mode** — each phase gets mock data in `virtualmin.ts` for local UI development.

See also [API.md](./API.md) for parameters per MVP command.
