# Qadbak installer

One-shot setup for **Ubuntu 22.04**: hosting stack + independent Qadbak panel.

## Requirements

- Ubuntu 22.04 VPS
- Root access
- DNS **A record** for panel hostname → server IP
- 1+ GB RAM (2+ GB recommended)

## Run

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh
```

See [docs/QADBAK-NATIVE-INSTALL.md](../docs/QADBAK-NATIVE-INSTALL.md).

## After install

```bash
sudo bash /opt/qadbak/scripts/update-qadbak.sh
curl -s http://127.0.0.1:3000/api/health
bash /opt/qadbak/scripts/audit-vm-dependency.sh
```

## Environment

Installer writes `/opt/qadbak/.env.local` with `QADBAK_PROVISIONER=native` and full `QADBAK_NATIVE_FEATURES`.

`install/qadbak-install-native.sh` is a compatibility alias for `qadbak-install.sh`.

## Migrating from another control panel

The installer targets **fresh VPS** setups. If an old GPL panel is still on the box, switch to native mode first (`apply-phase8-independent.sh`), verify the panel, then remove packages manually — see [docs/MIGRATE-FROM-VIRTUALMIN.md](../docs/MIGRATE-FROM-VIRTUALMIN.md).
