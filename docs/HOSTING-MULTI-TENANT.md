# Multi-tenant hosting (all legacy hosting API domains)

Qadbak server scripts are **not** tied to one customer domain. They read domains from legacy hosting API and apply the same rules to each.

| Script | Scope |
|--------|--------|
| `apply-customer-nginx-vhosts.sh` | **All** domains: nginx `server_name` → `/home/USER/public_html` |
| `fix-domain-website.sh DOMAIN` | One domain (Repair button); also refreshes **all** nginx vhosts |
| `apply-hosting-nginx.sh` | Panel host + default_server; probes one domain for Apache backend |
| `fix-domain-website.sh` | Per-domain legacy hosting API/Apache fix |

Docs use `example.com` as a placeholder. On your VPS, pass **your** domain:

```bash
sudo bash scripts/fix-domain-website.sh example.com
```

Fresh installs run `scripts/install-hosting-stack.sh` automatically (see `install/qadbak-install.sh`).

After **creating any domain** in the panel, Repair (or install) runs the same nginx + Apache setup for that unix user’s `public_html`.
