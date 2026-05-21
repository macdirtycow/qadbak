# E2E checklist (v1 exit)

Run on a **dedicated test VPS** only (`VIRTUALMIN_MOCK=false`). Not on mareades or other production.

Setup: [V1-TEST-SERVER.md](./V1-TEST-SERVER.md) · Preflight: `npm run preflight`  
Automated on **install** (real panel): `post-install-verify.sh` — [E2E-PLAYWRIGHT.md](./E2E-PLAYWRIGHT.md)  
Automated **local** (mock): `npm run test:e2e`

## Admin

- [ ] Login at `/login`
- [ ] Dashboard lists domains matching VirtualMin
- [ ] Create primary domain at `/domains/new`
- [ ] Create sub-server at `/domains/new?type=sub`
- [ ] Create alias at `/domains/new?type=alias`
- [ ] `/admin/status` — Webmin dashboard embed loads
- [ ] `/admin/system-menu` → open a module embed
- [ ] Resellers / plans / cloud / license pages load

## Per domain

- [ ] Overview `/domains/[domain]`
- [ ] Email: list, create mailbox
- [ ] DNS: view, add record
- [ ] SSL: list certs
- [ ] Files: embed file manager (live) or mock browser
- [ ] Terminal: embed xterm
- [ ] Backups: list schedules
- [ ] Lifecycle: disable domain (test domain only)

## Client

- [ ] Login as client with scoped `domains`
- [ ] Only assigned domains visible
- [ ] Cannot access `/admin`
