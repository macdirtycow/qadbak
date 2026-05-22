# Stack helpers (phase 5)

Sensitive server operations run through **validated scripts** instead of Webmin server modules (Apache, nginx, Postfix, BIND, firewall).

## Setup (VPS)

```bash
sudo bash /opt/qadbak/scripts/configure-stack-helper-sudo.sh
sudo bash /opt/qadbak/scripts/fix-qadbak-ownership.sh   # after git pull as root
sudo -u qadbak npm run build
bash /opt/qadbak/scripts/pm2-restart-qadbak.sh
```

## Panel

| Route | Purpose |
|-------|---------|
| `/admin/stack` | Validate full stack; reload nginx/Apache; apply customer vhosts; open firewall port |
| Domain overview → **Stack validate** | nginx vhost, Apache vhost, `public_html` for one domain |

## CLI (debug)

```bash
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-stack-helper.sh validate
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-stack-helper.sh domain-validate example.com
```

## Related helpers (already in repo)

| Helper | Script |
|--------|--------|
| Domain files | `domain-fs-helper.mjs` |
| Website repair | `fix-domain-website.sh` |
| Host services | `host-services-helper.mjs` |
| Nginx vhosts | `apply-customer-nginx-vhosts.sh` |

See [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md) phase 5.
