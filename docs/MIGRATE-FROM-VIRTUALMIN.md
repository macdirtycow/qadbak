# Migrate from VirtualMin (existing server → Qadbak-first)

For servers that **already run VirtualMin** (like a Contabo VPS after `qadbak-install.sh`):

## Test server (e.g. siccamanagement.nl on Contabo)

Use the **hybrid** apply script — keeps VirtualMin, adds phase 6 stack + helpers:

```bash
cd /opt/qadbak
git pull
sudo bash scripts/apply-phase6-test-server.sh
```

No full `qadbak-install-native.sh` on a box that already has VirtualMin and live test domains.

## You do not need phase 6 reinstall

- Panel uses `getProvisioner()` → VirtualMin API (headless Webmin)
- Customers use Qadbak UI only (phases 1–3)
- Admins use **Status**, **Services**, **Stack config** (phases 4–5)
- Webmin remains break-glass only

## Optional later: remove local Webmin

Only when `QADBAK_PROVISIONER=native` (phase 8) can provision domains without `remote.cgi`:

1. Export domain list, mailboxes, DNS zones from VirtualMin  
2. Import via future native scripts (Hestia-style `v-*` or Qadbak helpers)  
3. Stop/disable `webmin` service  
4. Close firewall port 10000  

Until then, keep VirtualMin installed but unused in daily work.

## New VPS without VirtualMin

Use [QADBAK-NATIVE-INSTALL.md](./QADBAK-NATIVE-INSTALL.md).

## Remote VirtualMin (split panel and engine)

On the **panel** `.env.local`:

```env
VIRTUALMIN_URL=https://YOUR-OLD-SERVER:10000/virtual-server/remote.cgi
VIRTUALMIN_USER=root
VIRTUALMIN_PASS=...
QADBAK_PROVISIONER=virtualmin
VIRTUALMIN_MOCK=false
```

Panel host only runs Qadbak + nginx; engine stays on the legacy server during transition.
