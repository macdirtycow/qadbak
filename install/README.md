# Qadbak installer

## Full native stack

One-shot setup for **Ubuntu 22.04/24.04/26.04** or **Debian 12**: hosting stack + independent Qadbak panel.

See [docs/LINUX-SUPPORT.md](../docs/LINUX-SUPPORT.md).

### Requirements

- Ubuntu 22.04/24.04/26.04 or Debian 12 VPS
- Root access
- DNS **A record** for panel hostname → server IP
- 1+ GB RAM (2+ GB recommended)

### Run

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash scripts/check-linux-support.sh
sudo bash install/qadbak-install.sh
```

See [docs/QADBAK-NATIVE-INSTALL.md](../docs/QADBAK-NATIVE-INSTALL.md).

## Panel-only (any Linux + Node 20+)

UI without nginx/mail/BIND on this host — mock demo or hybrid remote API.

```bash
sudo bash install/qadbak-install-panel.sh
```

Mock mode is for UI development only. Production hosting uses the full native installer above.

## After install

```bash
# Stay current (pull, rebuild, pm2 restart, license heartbeat)
sudo bash /opt/qadbak/scripts/update-qadbak.sh

# Re-run automated checks
sudo bash /opt/qadbak/scripts/post-install-verify.sh

# Panel unreachable (Cloudflare 520) after update:
sudo bash /opt/qadbak/scripts/fix-panel-now.sh
curl -s http://127.0.0.1:3000/api/health
```

**Optional (recommended on production VPS):**

```bash
# UFW: SSH + 80/443 (+ optional alt panel port)
sudo bash /opt/qadbak/scripts/configure-ufw-qadbak.sh

# Premium on an existing Core install
sudo bash /opt/qadbak/scripts/buy-premium.sh QAD-XXXX-YYYY-ZZZZ-WWWW

# iOS app readiness (HTTPS + Premium + Qmail)
sudo bash /opt/qadbak/scripts/check-mobile-readiness.sh YOUR_DOMAIN info
```

Manual QA checklist: [docs/E2E-CHECKLIST.md](../docs/E2E-CHECKLIST.md). iOS app: [docs/MOBILE-IOS-APP.md](../docs/MOBILE-IOS-APP.md).

## Environment

Installer writes `/opt/qadbak/.env.local` with `QADBAK_PROVISIONER=native` and full `QADBAK_NATIVE_FEATURES`.

`install/qadbak-install-native.sh` is a compatibility alias for `qadbak-install.sh`.

## Migrating from another control panel

The installer targets **fresh VPS** setups. If an old GPL panel is still on the box, switch to native mode first (`apply-phase8-independent.sh`), verify the panel, then remove packages manually — see [docs/MIGRATE-FROM-LEGACY-HOSTING.md](../docs/MIGRATE-FROM-LEGACY-HOSTING.md).

Resume after failure:

```bash
sudo bash install/qadbak-install-resume.sh          # full native stack
sudo bash install/qadbak-install-panel-resume.sh    # panel-only
```

## Uninstall

```bash
sudo bash /opt/qadbak/install/qadbak-uninstall.sh           # safe default (panel only)
sudo bash /opt/qadbak/install/qadbak-uninstall.sh --help    # see all flags
sudo bash /opt/qadbak/install/qadbak-uninstall.sh --dry-run # preview, change nothing
```

By default the uninstaller **keeps your hosting stack and customer data**
(nginx, mariadb, postfix, dovecot, bind, /var/www) — only the Qadbak panel
itself is removed. Use `--remove-stack` and `--remove-customers` for a full
wipe (test VPS only).
