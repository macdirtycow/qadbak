# Qadbak installer

One-shot setup for **Ubuntu 22.04**: VirtualMin GPL + Qadbak panel + nginx + TLS.

## Requirements

- Fresh or existing Ubuntu 22.04 VPS
- Root access
- DNS **A record** for panel hostname → server IP
- 2+ GB RAM recommended for VirtualMin

## Run

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
sudo bash install/qadbak-install.sh
```

You will be prompted for:

1. **Panel hostname** — where users open Qadbak (e.g. `panel.example.com`)
2. **Webmin root password** — existing or new VirtualMin root password
3. **Qadbak admin** username and password
4. **Certbot email** for Let's Encrypt

## What it installs

| Component | Location |
|-----------|----------|
| **Node.js 20 + npm** | NodeSource apt repo (automatic — nothing to install by hand) |
| **pm2** | `npm install -g pm2` if not present |
| VirtualMin | Official `virtualmin-install.sh` (includes Webmin) |
| Qadbak app | `/opt/qadbak` — `npm install` + `npm run build` |
| Process manager | `pm2` as user `qadbak` |
| Reverse proxy | nginx from `deploy/nginx-qadbak.conf` |

## After install

```bash
sudo -u qadbak pm2 logs qadbak
curl -sI "https://YOUR_PANEL_HOST/login"
```

## Re-run / update

Safe to run `git pull` in `/opt/qadbak` then:

```bash
sudo -u qadbak bash -c 'cd /opt/qadbak && npm install && npm run build && pm2 restart qadbak'
```

## Test on clean VM

Use a separate Ubuntu 22.04 VPS (not production). Verify:

- [ ] `https://PANEL_HOST/login` loads
- [ ] `npm run test-api` as `qadbak` user succeeds
- [ ] Domain list matches VirtualMin
- [ ] `/admin/status` embed loads

## Environment

Installer writes `/opt/qadbak/.env.local` including `QADBAK_PUBLIC_HOST` for branding metadata.

`NODE_TLS_REJECT_UNAUTHORIZED=0` is set when VirtualMin uses a self-signed certificate on localhost — replace with proper CA on production if possible.
