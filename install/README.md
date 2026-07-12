# Qadbak installer

## Full native stack

One-shot setup for a **Debian-based Linux distribution**, including **Debian 12** and **Ubuntu 22.04/24.04/26.04 LTS**: hosting stack + independent Qadbak panel.

See [docs/LINUX-SUPPORT.md](../docs/LINUX-SUPPORT.md).

### Requirements

- Debian-based Linux VPS (Debian 12 or Ubuntu 22.04/24.04/26.04 LTS)
- Root access
- DNS **A record** for panel hostname → server IP
- 1+ GB RAM (2+ GB recommended)
- Node.js 20+ (installed automatically by the native installer when missing)

### Run

```bash
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash scripts/check-linux-support.sh
sudo bash install/qadbak-install.sh
```

See [docs/QADBAK-NATIVE-INSTALL.md](../docs/QADBAK-NATIVE-INSTALL.md).

## Panel-only (Linux + Node 20+)

UI without nginx/mail/BIND on this host - mock demo or hybrid remote API.

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
