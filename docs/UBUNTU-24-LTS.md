# Ubuntu & Debian LTS

Qadbak native install supports:

- **Ubuntu** 22.04, 24.04, and **26.04** LTS (Jammy, Noble, …)
- **Debian** 12 (Bookworm)

Full matrix: [LINUX-SUPPORT.md](./LINUX-SUPPORT.md)

| Area | Notes |
|------|--------|
| Stack | nginx, Apache, MariaDB, Postfix, Dovecot, BIND, PHP-FPM |
| PHP | 8.1 (22.04), 8.3 (24.04), 8.4 (26.04), 8.2 (Debian 12) |
| Panel | Node.js 20+ |

Before install:

```bash
sudo bash /opt/qadbak/scripts/check-linux-support.sh
```

Install: [install/qadbak-install.sh](../install/qadbak-install.sh)

Panel-only (no stack): [install/qadbak-install-panel.sh](../install/qadbak-install-panel.sh)

Commercial Premium is delivered via the **license server** after you activate a key in the panel — not via a separate public GitHub repository. See [COMMERCIAL-LICENSING.md](../COMMERCIAL-LICENSING.md).
