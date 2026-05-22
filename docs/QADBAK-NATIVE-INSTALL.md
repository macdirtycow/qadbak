# Qadbak native install (phase 6)

Fresh Ubuntu VPS **without** running `virtualmin-install.sh` on the same machine.

## When to use

| Scenario | Installer |
|----------|-----------|
| New VPS, Qadbak-first | `sudo bash install/qadbak-install-native.sh` |
| Existing VPS with VirtualMin (your Contabo server) | Keep current setup — **no reinstall needed** |
| Import domains from another VirtualMin host | Set `VIRTUALMIN_URL` in `.env.local` to remote `remote.cgi` |

## Install

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install-native.sh
```

Or from the standard installer: answer **n** to “Install VirtualMin on this server?”

## What gets installed

- nginx, Apache (127.0.0.1:8080), MariaDB, Postfix, Dovecot, BIND9, PHP-FPM
- Qadbak panel + pm2 + all sudo helpers (files, terminal, stack, repair)
- **No** local Webmin on port 10000

## Provisioning domains

Until `QADBAK_PROVISIONER=native` (phase 8) exists:

1. **Remote VirtualMin** — point `.env.local` at another server’s `remote.cgi`, or  
2. **Migrate** from an existing box — see [MIGRATE-FROM-VIRTUALMIN.md](./MIGRATE-FROM-VIRTUALMIN.md), or  
3. **Mock mode** — UI development only (`VIRTUALMIN_MOCK=true`)

## Test VPS with VirtualMin already (siccamanagement.nl)

```bash
sudo bash /opt/qadbak/scripts/apply-phase6-test-server.sh
```

Hybrid mode: native stack + helpers, VirtualMin stays as engine. See [MIGRATE-FROM-VIRTUALMIN.md](./MIGRATE-FROM-VIRTUALMIN.md).
