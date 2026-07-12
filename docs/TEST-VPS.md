# Testing on a separate VPS

Use a **dedicated test server** (e.g. rent one for a month). **Never** use your live production server or any host with live client sites.

**Start here:** [V1-TEST-SERVER.md](./V1-TEST-SERVER.md) (full step-by-step).  
**Getting started:** [V1-TEST-SERVER.md](./V1-TEST-SERVER.md) · [E2E-CHECKLIST.md](./E2E-CHECKLIST.md).

## Option A — Qadbak + legacy hosting API on one test VPS (recommended to start)

1. VPS with Ubuntu, install legacy hosting API.
2. Create a test domain in legacy hosting API.
3. Run Qadbak on the same machine:

```env
QADBAK_LEGACY_API_MOCK=false
QADBAK_LEGACY_API_URL=https://127.0.0.1:10000/virtual-server/remote.cgi
QADBAK_LEGACY_PANEL_URL=https://<your-test-host>:10000
QADBAK_ACCOUNT_PANEL_UI_URL=https://<your-test-host>:20000
```

4. `npm run test-api` → JSON from `list-domains` should appear.
5. Nginx: [deploy/nginx-qadbak.conf](../deploy/nginx-qadbak.conf).

## Option B — Qadbak on a different machine than legacy hosting API

- Firewall: only the Qadbak host IP may reach ports 10000/20000 on the test VPS.
- `QADBAK_LEGACY_API_URL` points to the **external** URL of the test VPS.

## Post-install checklist

- [ ] `QADBAK_LEGACY_API_MOCK=false`
- [ ] `SESSION_SECRET` unique and long
- [ ] Default passwords in `data/users.json` changed
- [ ] `npm run test-api` succeeds
- [ ] Sign in to Qadbak; domain list matches legacy hosting API
- [ ] server admin tab opens login link
- [ ] Client account with limited `domains` tested

## Mock vs live

| Feature | Mock (`QADBAK_LEGACY_API_MOCK=true`) | Live server |
|---------|-------------------------------|-------------|
| Domains, mail, DNS, … | Simulated | Via `remote.cgi` |
| Files in Qadbak | Full browser | Link to server admin file manager |
| server admin modules | Test URLs | `create-login-link` |
