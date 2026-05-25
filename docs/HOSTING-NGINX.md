# Customer websites vs Qadbak panel (nginx)

## Problem

If nginx uses `default_server` on port 80 and proxies **everything** to Qadbak (`127.0.0.1:3000`), customer domains show the Qadbak marketing page instead of files in `/home/USER/public_html`.

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
sudo bash scripts/ensure-apache-backend.sh   # Apache must run (usually :8080)
sudo bash scripts/apply-hosting-nginx.sh
sudo bash scripts/fix-domain-website.sh example.com
```

If repair shows **apache2: not active** and local probe **502**, Apache failed to start — the script prints `journalctl` hints. Common fix when nginx owns port 80: Apache should only `Listen 127.0.0.1:8080` in `/etc/apache2/ports.conf` (the repair script can adjust this automatically).

`QADBAK_PUBLIC_HOST` must be a **hostname** (e.g. `vps.example.com`), not a bare IP. If Let's Encrypt is not installed for the panel host, the script uses HTTP-only nginx (panel stays on `:11000` or port 80 without TLS).

Check:

```bash
curl -sI -H 'Host: example.com' http://127.0.0.1/ | head -5
# Should NOT return Next.js / Qadbak HTML
```

Upload the site via Qadbak **Files** → `public_html` (or VirtualMin).

If visitors still see **Apache2 Ubuntu Default Page** (`/var/www/html`), Apache has no vhost for your domain on the backend port (usually `8080`). Diagnose and fix:

```bash
sudo bash scripts/diagnose-domain-web-root.sh example.com
sudo bash scripts/fix-domain-website.sh example.com
```

Your edited file must be `/home/USER/public_html/index.html`, not `/var/www/html/index.html`.

**Repair** also runs `apply-customer-nginx-vhosts.sh`: nginx `server_name` per domain points **directly** at `public_html` (wins over `default_server` → Apache). PHP still goes to Apache on the backend port when no PHP-FPM pool exists.

### HTTPS shows `{"error":"Not found"}`

That JSON comes from the **license API** (or another Qadbak service on port 443), not from your website. Nginx had no TLS vhost for your domain, so the wrong `default_server` on 443 answered.

Fix on the VPS:

```bash
sudo bash scripts/fix-domain-website.sh YOUR_DOMAIN
```

This rebuilds the customer vhost (HTTP + HTTPS when a Let's Encrypt cert exists), optionally runs certbot, and adds a placeholder `public_html/index.html` if the folder is empty.

## Block unknown hostnames

When a fresh domain points at the VPS before it's added in the panel,
nginx falls through to whichever vhost claims `default_server`. On a
stock install that's the Qadbak panel vhost (which proxies unknown
hosts to Apache). On servers that also run the license server, panel,
or any other Qadbak service, an unrelated vhost can end up answering
for completely unconfigured hostnames — at worst leaking the public
"Buy license" page to anyone hitting the IP from an unknown DNS name.

`scripts/apply-nginx-default-deny.sh` ships a neutral catch-all vhost
that returns HTTP 444 (drop connection) on both port 80 and 443. The
HTTPS listener uses a self-signed cert at
`/etc/ssl/certs/qadbak-default-deny.crt` so SSL handshakes complete
cleanly before nginx drops the request — unknown hosts never see
`ERR_SSL_PROTOCOL_ERROR`, just a clean close.

Fresh installs get this automatically. Existing VPS-en backfill with:

```bash
sudo bash /opt/qadbak/scripts/apply-nginx-default-deny.sh
```

The script refuses to enable itself if another vhost already claims
`default_server` on the same port — it prints the exact `sed` command
to strip `default_server` from the conflicting file instead of guessing
which vhost "should" be the default. Diagnose without writing anything:

```bash
sudo bash /opt/qadbak/scripts/apply-nginx-default-deny.sh --check
```

## Cloudflare

- **A** record → VPS IP (`QADBAK_ORIGIN_IP` in `.env.local`).
- **Flexible** SSL is fine while origin is HTTP-only on port 80.
- After Let's Encrypt on the server, switch to **Full**.

See also `docs/CLOUDFLARE.md` and `docs/FRONT-DOOR.md`.
