# Qadbak installer

One-shot setup for **Ubuntu 22.04**: native hosting stack + Qadbak panel.

Does **not** install Webmin, VirtualMin, or Usermin. If those packages are already on the server, remove them after the panel works:

```bash
sudo bash /opt/qadbak/scripts/uninstall-virtualmin.sh
```

## Requirements

- Ubuntu 22.04 VPS
- Root access
- DNS **A record** for panel hostname → server IP
- 1+ GB RAM (2+ GB recommended)

## Run

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
sudo bash install/qadbak-install.sh
```

Prompts: panel hostname, admin password, optional certbot email, optional demo client.

Post-install runs **phase 8 independent** (`QADBAK_PROVISIONER=native`) and **post-install verification**.

## What it installs

| Component | Notes |
|-----------|--------|
| Node.js 20 + npm | NodeSource |
| pm2 | global |
| Hosting stack | `scripts/install-native-stack.sh` |
| Qadbak app | `/opt/qadbak` |
| Terminals | `ws` + `node-pty` via `npm install`, pm2 `qadbak-terminal` |

## After install

```bash
sudo bash /opt/qadbak/scripts/update-qadbak.sh
curl -s http://127.0.0.1:3000/api/health
sudo bash /opt/qadbak/scripts/check-terminal-ws.sh
```

## Remove old Webmin / VirtualMin

```bash
sudo bash /opt/qadbak/scripts/uninstall-virtualmin.sh
```

## Environment

Installer writes `/opt/qadbak/.env.local` with `QADBAK_PROVISIONER=native`, `QADBAK_DISABLE_WEBMIN=true`, and full `QADBAK_NATIVE_FEATURES`.

Legacy GPL installer (not for new servers): `install/legacy/qadbak-install-virtualmin.sh`
