# Changelog

All notable changes to Qadbak are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-15

### Added

- **Ubuntu LTS release upgrade** in Admin → Updates — in-place upgrade 22.04→24.04 or 24.04→26.04 via `do-release-upgrade`, with preflight checks, live job log, and automatic stack repair + reboot
- `scripts/ubuntu-release-upgrade.sh` and `scripts/post-ubuntu-release-upgrade.sh`
- API route `/api/admin/updates/ubuntu-release`

## [1.0.0] - 2026-06-15

First stable release after 334 commits of active development.

### Highlights

- **Native hosting stack** — nginx, Apache, MariaDB, Postfix, Dovecot, BIND9, PHP-FPM, certbot on Ubuntu 22.04/24.04/26.04 and Debian 12
- **Panel-only install** — run the Next.js UI on any Linux with Node 20+ (mock demo or hybrid remote API)
- **Domain lifecycle** — sites, mail, DNS, TLS, databases, backups, cron, file manager, per-domain terminal
- **App store** — 24+ one-click catalog installs into `public_html`
- **Media server** — Jellyfin one-click + panel media library + HTML5 quick player
- **Operations** — action journal with undo, health checks, metrics history, alert rules
- **API v1** — bearer keys with scoped access for domains, mail, DNS, SSL, suspend, backups
- **Security** — ModSecurity WAF, ClamAV scans, fail2ban, rate limits, TOTP, defense-in-depth controls
- **Premium modules** — client portal, RBAC, webmail, white-label, license admin (gated by license key)
- **CI** — GitHub Actions build, E2E smoke, and Linux distro support checks

### Install

```bash
# Full native stack (Ubuntu / Debian)
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh

# Panel-only (any Linux + Node 20+)
sudo bash install/qadbak-install-panel.sh
```

See [docs/LINUX-SUPPORT.md](docs/LINUX-SUPPORT.md) and [docs/QADBAK-NATIVE-INSTALL.md](docs/QADBAK-NATIVE-INSTALL.md).

[1.1.0]: https://github.com/macdirtycow/qadbak/releases/tag/v1.1.0
[1.0.0]: https://github.com/macdirtycow/qadbak/releases/tag/v1.0.0
