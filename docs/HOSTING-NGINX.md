# Customer websites vs Qadbak panel (nginx)

## Problem

If nginx uses `default_server` on port 80 and proxies **everything** to Qadbak (`127.0.0.1:3000`), domains like `siccamanagement.nl` show the Qadbak marketing page instead of files in `/home/USER/public_html`.

## Fix (this repo)

`deploy/nginx-qadbak.conf` now:

| Request | Served by |
|---------|-----------|
| `Host` = panel hostname or server FQDN | Qadbak (Next.js on `:3000`) |
| Any other `Host` (customer domains, bare IP) | Apache via `__APACHE_BACKEND__` (usually `127.0.0.1:8080`) |

Panel login without a customer domain name: use **https://panel-host/login** or **http://SERVER_IP:11000/login** (`enable-panel-port.sh`).

## Apply on an existing VPS

```bash
cd /opt/qadbak && git pull
sudo bash scripts/apply-hosting-nginx.sh
sudo bash scripts/fix-domain-website.sh siccamanagement.nl
```

Check:

```bash
curl -sI -H 'Host: siccamanagement.nl' http://127.0.0.1/ | head -5
# Should NOT return Next.js / Qadbak HTML
```

Upload the site via Qadbak **Files** → `public_html` (or VirtualMin).

## Cloudflare

- **A** record → VPS IP (`QADBAK_ORIGIN_IP` in `.env.local`).
- **Flexible** SSL is fine while origin is HTTP-only on port 80.
- After Let's Encrypt on the server, switch to **Full**.

See also `docs/CLOUDFLARE.md` and `docs/FRONT-DOOR.md`.
