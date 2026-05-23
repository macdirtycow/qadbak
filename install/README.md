# Qadbak installer

One-shot setup for **Ubuntu 22.04**: native hosting stack + Qadbak panel (no VirtualMin/Webmin on the server).

## Requirements

- Fresh or existing Ubuntu 22.04 VPS
- Root access
- DNS **A record** for panel hostname → server IP
- 1+ GB RAM (2+ GB recommended)

## Run (default — native)

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
sudo bash install/qadbak-install.sh
```

This installs nginx, Apache, MariaDB, Postfix, Dovecot, BIND, and configures **independent native** provisioning (`QADBAK_PROVISIONER=native`). See [docs/QADBAK-NATIVE-INSTALL.md](../docs/QADBAK-NATIVE-INSTALL.md).

You will be prompted for:

1. **Panel hostname** — where users open Qadbak (e.g. `panel.example.com`)
2. **Qadbak admin** username and password
3. **Certbot email** (optional)
4. **Optional demo client user** (RBAC testing)
5. **Optional remote VirtualMin API** (hybrid only — leave blank for fully independent)

Runs **post-install verification** at the end (preflight, health, Playwright E2E).

## Legacy: VirtualMin + Webmin on the same machine

Only if you need the old GPL stack:

```bash
sudo bash install/qadbak-install.sh
# answer y to "legacy VirtualMin installer"
# or:
sudo bash install/qadbak-install-virtualmin.sh
```

Migrating from an existing VirtualMin server: [docs/MIGRATE-FROM-VIRTUALMIN.md](../docs/MIGRATE-FROM-VIRTUALMIN.md).

## What the native installer installs

| Component | Location |
|-----------|----------|
| **Node.js 20 + npm** | NodeSource apt repo |
| **pm2** | global npm |
| **Hosting stack** | `scripts/install-native-stack.sh` |
| **Qadbak app** | `/opt/qadbak` — `npm install` + `npm run build` |
| **Process manager** | `pm2` as user `qadbak` |
| **Reverse proxy** | nginx from `deploy/nginx-qadbak.conf` |

Does **not** install VirtualMin or Webmin.

## After install

```bash
sudo -u qadbak pm2 logs qadbak
curl -s "http://127.0.0.1:3000/api/health"
```

## Re-run / update

```bash
sudo bash /opt/qadbak/scripts/update-qadbak.sh
```

## Environment

Installer writes `/opt/qadbak/.env.local` with `QADBAK_PUBLIC_HOST`, `QADBAK_PROVISIONER=native`, and `QADBAK_NATIVE_FEATURES=…` for independent mode.
