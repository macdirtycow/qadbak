# Host admin (phase 4)

Server admins manage the VPS from **Qadbak** — not the Webmin dashboard on port 10000.

## Screens

| Route | What |
|-------|------|
| `/admin/status` | CPU, RAM, disk, firewall (`/proc`, `df`, `ufw`) + services |
| `/admin/server` | Start / stop / restart allowlisted systemd units |
| `/admin/resellers`, `/admin/plans`, … | VirtualMin API via `getProvisioner()` |

## Native service control

On the server (once per VPS):

```bash
sudo bash /opt/qadbak/scripts/configure-host-services-sudo.sh
pm2 restart qadbak
```

After `git pull` as **root**, fix ownership before `npm install` as qadbak:

```bash
sudo bash /opt/qadbak/scripts/fix-qadbak-ownership.sh
sudo -u qadbak npm install && sudo -u qadbak npm run build
```

Or use one command: `sudo bash /opt/qadbak/scripts/update-qadbak.sh`

Allowlisted units: `nginx`, `apache2`/`httpd`, `postfix`, `dovecot`, `named`/`bind9`, `mariadb`, PHP-FPM.

Without sudo, service list/restart falls back to VirtualMin `list-server-statuses` / `restart-server`.

## Break-glass Webmin

- `/admin/webmin` and embed routes still work.
- Main nav hides Webmin module menus unless `QADBAK_SHOW_WEBMIN_NAV=true` in `.env.local`.
- Overview card links to the Webmin hub for emergencies.

See [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md) phase 4 · [STACK-HELPERS.md](./STACK-HELPERS.md) phase 5.
