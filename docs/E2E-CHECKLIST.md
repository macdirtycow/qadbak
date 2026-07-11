# Post-install QA checklist

Use on a **test VPS** or right after a fresh install — not as a daily routine on busy production hosts.

**Automated on install:** `sudo bash /opt/qadbak/scripts/post-install-verify.sh` (preflight + `/api/health` + Playwright E2E).  
**Local dev (mock):** `npm run test:e2e`  
Details: [E2E-PLAYWRIGHT.md](./E2E-PLAYWRIGHT.md) · Native install: [QADBAK-NATIVE-INSTALL.md](./QADBAK-NATIVE-INSTALL.md)

## Admin

- [ ] Login at `/login`
- [ ] Dashboard loads
- [ ] Create primary domain at `/domains/new`
- [ ] Create subdomain at `/domains/new?type=sub`
- [ ] Create alias at `/domains/new?type=alias`
- [ ] `/admin` — Server admin loads
- [ ] `/admin/status` — services overview
- [ ] Premium: `/admin/updates`, resellers, license pages load

## Per domain

- [ ] Overview `/domains/[domain]`
- [ ] Email: list, create mailbox
- [ ] DNS: view, add record
- [ ] SSL: Let's Encrypt issue or renew
- [ ] Files: file manager lists domain home
- [ ] Terminal: shell session starts
- [ ] Backups: list / download
- [ ] Lifecycle: disable domain (test domain only)

## Mail (native stack)

- [ ] `sudo bash scripts/test-mail-send.sh DOMAIN info you@example.com`
- [ ] `sudo bash scripts/test-mail-receive.sh DOMAIN info`
- [ ] SPF/DKIM/DMARC helpers visible in panel

## Client (if created at install)

- [ ] Login as client with scoped `domains`
- [ ] Only assigned domains visible
- [ ] Cannot access `/admin`

## Mobile / Premium (optional)

- [ ] `sudo bash scripts/check-mobile-readiness.sh DOMAIN info`
- [ ] iOS app sign-in against `https://panel-host` — [MOBILE-IOS-APP.md](./MOBILE-IOS-APP.md)
