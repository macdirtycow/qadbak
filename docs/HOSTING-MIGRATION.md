# Hosting migration (manual)

Move customer sites from **old VPS** (`vmi2930777`) to **new Contabo** (24 GB / 400 GB). Leave **license-server only** on the old box (`license.inveil.dev`).

## Prerequisites

- New server: Ubuntu 22.04, root SSH, firewall allows 22/80/443
- DNS: lower TTL to **300** at least **24 hours** before each cutover
- `qadbak-premium` repo is **private** (no public clone URLs in docs)

## One-time on new server

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh
```

Set `QADBAK_PUBLIC_HOST` in `/opt/qadbak/.env.local` (panel hostname).

## Per domain (order)

1. **sdconderhoud.nl** (lowest risk)
2. Other own domains
3. **qadbak.com** last (panel briefly offline — evening window)

### Export on old server

```bash
DOMAIN=sdconderhoud.nl
USER=<unix_user>   # from panel or: ls /home

# Website
rsync -avz /home/$USER/public_html/ root@NEW_IP:/home/$USER/public_html/

# Mail (if used)
rsync -avz /home/$USER/Maildir/ root@NEW_IP:/home/$USER/Maildir/ 2>/dev/null || true

# MySQL — list DBs: mysql -e "SHOW DATABASES LIKE '${USER}_%'"
mysqldump --single-transaction DB_NAME | ssh root@NEW_IP "mysql DB_NAME"
```

Or download a backup tarball from the panel (**Backups → Download**) and restore manually.

### On new server

- Add domain in panel (or recreate unix user + vhost)
- `sudo ISSUE_SSL=1 bash scripts/apply-domain-nginx.sh $DOMAIN $USER`
- Point DNS A-record to new IP
- Smoke: `curl -sI -H "Host: $DOMAIN" https://$DOMAIN/`

### qadbak.com panel cutover

Copy before DNS switch:

```bash
scp root@OLD:/opt/qadbak/data/users.json root@NEW:/opt/qadbak/data/
scp root@OLD:/opt/qadbak/data/license.json root@NEW:/opt/qadbak/data/
scp root@OLD:/opt/qadbak/.env.local root@NEW:/opt/qadbak/
sudo chown -R qadbak:qadbak /opt/qadbak/data /opt/qadbak/.env.local
sudo -u qadbak pm2 restart qadbak --update-env
```

`QADBAK_LICENSE_SERVER` stays `https://license.inveil.dev` (old IP / same hostname).

### After 7 days

Remove domain on old server only after confirming no traffic. Then strip panel from old server (keep license-server stack). See plan: uninstall Apache/PHP/Dovecot, remove `/opt/qadbak`, keep Node + license-server.

## Future

**F6** (backlog): `export-domain.sh` / `import-domain.sh` for panel-driven moves between Qadbak hosts.
