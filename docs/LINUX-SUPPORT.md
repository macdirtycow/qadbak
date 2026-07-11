# Linux support — Qadbak

Qadbak supports three install profiles on Linux.

## Native full stack (hosting VPS)

**Supported OS:**

| Distro | Versions | PHP default |
|--------|----------|-------------|
| Ubuntu | 22.04, 24.04, **26.04** LTS | 8.1 / 8.3 / 8.4 |
| Debian | **12** (Bookworm) | 8.2 |

Installer: `sudo bash install/qadbak-install.sh`

Pre-flight check:

```bash
sudo bash scripts/check-linux-support.sh
# or legacy name:
sudo bash scripts/check-ubuntu-support.sh
```

What gets installed: nginx, Apache, MariaDB, Postfix, Dovecot, BIND9, PHP-FPM, panel (pm2), native provisioning.

Distro detection lives in `scripts/lib/linux-distro.sh` (Ubuntu-specific helpers remain in `scripts/lib/ubuntu-release.sh` as a thin wrapper).

<a id="panel-only"></a>

## Panel-only (any Linux with Node 20+)

Run the **UI only** — no mail/DNS/hosting stack on this machine.

**Use when:**

- Developing the panel locally or on a non-Ubuntu server
- The hosting engine runs elsewhere (hybrid + remote legacy API)
- Demo/mock mode (`QADBAK_LEGACY_API_MOCK=true`)

Installer:

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install-panel.sh
```

Resume after failure:

```bash
sudo bash install/qadbak-install-panel-resume.sh
```

Pre-flight (Node only):

```bash
bash scripts/check-linux-support.sh --panel-only
```

**Requirements:**

- Node.js **20+** and npm
- Optional: pm2 (installed automatically when possible)
- On Debian/Ubuntu: build tools for `node-pty` (terminal tab) via `scripts/install-node-build-deps.sh`
- On other distros: install `make` and `g++` manually if you need the in-panel terminal

**Provisioning modes** (chosen during install):

1. **Mock** — fake domains in the UI; no server backend
2. **Hybrid remote** — panel talks to a legacy hosting API on another host (`QADBAK_LEGACY_API_URL`)

Put **nginx**, Caddy, or a cloud load balancer in front of port `3000` for HTTPS (or accept the optional nginx step in the installer on apt-based systems).

The `/api/health` endpoint reports `installMode` and parsed `os` from `/etc/os-release` when available.

## Ubuntu 26.04 (forward support)

26.04 is included in the supported list with PHP **8.4** packages. Test on release images before production cutover; package names may shift slightly.

## Not yet supported (native stack)

| Distro | Status |
|--------|--------|
| Rocky / Alma / RHEL | Planned — needs `dnf` package mapping |
| Arch / Alpine | Panel-only possible; native stack not targeted |

## Environment reference

| Variable | Native install | Panel-only mock | Panel-only hybrid |
|----------|----------------|-----------------|-------------------|
| `QADBAK_INSTALL_MODE` | `native` | `panel-only` | `panel-only` |
| `QADBAK_PROVISIONER` | `native` | `hybrid` | `hybrid` |
| `QADBAK_LEGACY_API_MOCK` | `false` | `true` | `false` |

See also: [QADBAK-NATIVE-INSTALL.md](./QADBAK-NATIVE-INSTALL.md), [UBUNTU-24-LTS.md](./UBUNTU-24-LTS.md).
