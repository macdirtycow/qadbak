# Qadbak installer

One-shot setup for **Ubuntu 22.04**: hosting stack + independent Qadbak panel.

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

See [docs/QADBAK-NATIVE-INSTALL.md](../docs/QADBAK-NATIVE-INSTALL.md).

## After install

```bash
sudo bash /opt/qadbak/scripts/update-qadbak.sh
curl -s http://127.0.0.1:3000/api/health
```

## Remove old GPL panel packages (optional)

If this server previously had another hosting control panel installed:

```bash
sudo bash /opt/qadbak/scripts/uninstall-legacy-panel.sh
```

## Environment

Installer writes `/opt/qadbak/.env.local` with `QADBAK_PROVISIONER=native` and full `QADBAK_NATIVE_FEATURES`.

`install/qadbak-install-native.sh` is a compatibility alias for `qadbak-install.sh`.
