# Migrate from VirtualMin (existing server → Qadbak-first)

For servers that **already run VirtualMin** (like a Contabo VPS after `qadbak-install.sh`):

## Test server (e.g. example.com on any VPS provider)

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

Only when `QADBAK_PROVISIONER=native` and panel tests pass:

1. `sudo bash scripts/apply-phase8-independent.sh`
2. `bash scripts/audit-vm-dependency.sh`
3. Backup the VPS, then remove packages manually — see [PHASE-8-INDEPENDENT.md](./PHASE-8-INDEPENDENT.md#legacy-panel-packages-optional)

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
