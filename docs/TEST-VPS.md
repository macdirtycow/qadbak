# Testing on a separate VPS

Use a **dedicated test server** (e.g. rent one for a month) so you do not touch production VirtualMin with real domains.

## Option A — Qadbak + VirtualMin on one test VPS (recommended to start)

1. VPS with Ubuntu, install VirtualMin.
2. Create a test domain in VirtualMin.
3. Run Qadbak on the same machine:

```env
VIRTUALMIN_MOCK=false
VIRTUALMIN_URL=https://127.0.0.1:10000/virtual-server/remote.cgi
WEBMIN_UI_URL=https://<your-test-host>:10000
USERMIN_UI_URL=https://<your-test-host>:20000
```

4. `npm run test-api` → JSON from `list-domains` should appear.
5. Nginx: [deploy/nginx-qadbak.conf](../deploy/nginx-qadbak.conf).

## Option B — Qadbak on a different machine than VirtualMin

- Firewall: only the Qadbak host IP may reach ports 10000/20000 on the test VPS.
- `VIRTUALMIN_URL` points to the **external** URL of the test VPS.

## Post-install checklist

- [ ] `VIRTUALMIN_MOCK=false`
- [ ] `SESSION_SECRET` unique and long
- [ ] Default passwords in `data/users.json` changed
- [ ] `npm run test-api` succeeds
- [ ] Sign in to Qadbak; domain list matches VirtualMin
- [ ] Webmin tab opens login link
- [ ] Client account with limited `domains` tested

## Mock vs live

| Feature | Mock (`VIRTUALMIN_MOCK=true`) | Live server |
|---------|-------------------------------|-------------|
| Domains, mail, DNS, … | Simulated | Via `remote.cgi` |
| Files in Qadbak | Full browser | Link to Webmin file manager |
| Webmin modules | Test URLs | `create-login-link` |
