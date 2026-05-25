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

## End-to-end domain creation

Creating a domain from the panel (**Domains → New domain**, which hits
`POST /api/domains`) now wires up the full hosting stack
automatically: unix user + `public_html`, Qadbak landing page, Apache
backend vhost, nginx customer vhost on port 80 *and* 443, a Let's
Encrypt certificate when DNS is ready, and a per-tenant PHP-FPM pool
when the licence allows it. No follow-up `apply-*.sh` / `ISSUE_SSL=1`
commands are required — fresh domains serve over HTTP and HTTPS the
moment the API returns success.

If something does need to be re-applied (for example a domain that
existed before this change, or a certbot run that was rate-limited at
create time), the **single operator entry point** is:

```bash
sudo bash /opt/qadbak/scripts/ensure-domain-website.sh DOMAIN UNIX_USER
```

The script is idempotent: it is safe to run repeatedly. It never
overwrites real customer content — it only refreshes its own Qadbak
landing page when the current `public_html/index.html` is empty, a
known placeholder (`Hello` / `OK`), or a landing it wrote itself.

`scripts/fix-domain-website.sh` and `scripts/repair-all-websites.sh`
both delegate to `ensure-domain-website.sh` for the actual website
work; they add firewall opening, Apache backend bring-up,
hosting-nginx refresh, VirtualMin sync, and Cloudflare-aware probes
on top.

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

## Client panel access (per-domain `panel.<customer>` vhost)

Premium feature, opt-in: customers can reach their copy of the Qadbak
panel on `https://panel.<their-domain>/login` instead of (or in addition
to) the operator's main panel host. The "Apply panel vhost" button in
**Domains → \<domain\> → Client panel access** card calls
`scripts/apply-client-panel-vhost.sh` (via the sudo wrapper installed by
`scripts/configure-panel-vhost-sudo.sh`).

What the script writes (`/etc/nginx/sites-available/qadbak-panel-<slug>.conf`):

- `server_name panel.<domain>;` — **only**. Never `_`, never
  `default_server`. Those slots belong to the main panel vhost
  (`deploy/nginx-qadbak.conf`) and the optional default-deny vhost
  (`scripts/apply-nginx-default-deny.sh`); claiming them a second time
  produces `[warn] conflicting server name "_"` on every reload and at
  worst crashes nginx with `[emerg] a duplicate default server`.
- `listen 443 ssl;` — **without** `http2`. The main panel vhost already
  declares `http2` on the same listener pair, and `http2` is a
  per-listener protocol option. Repeating it would produce
  `[warn] protocol options redefined for 0.0.0.0:443` on every reload.
  nginx still serves HTTP/2 here because the listener-wide setting from
  the main vhost wins.
- The script obtains the cert with `certbot certonly --nginx`
  (authenticator only, no installer) so certbot never rewrites the
  vhost file. The HTTPS block is rendered by the script itself in a
  second pass after the cert lands.

### DNS

The first time a panel vhost is applied for a customer domain, an
external **A-record for `panel.<domain>`** pointing at the server IP
must exist or be added — the script prints the exact line at the top
of its output. When the server is also the authoritative BIND nameserver
for that zone (`scripts/ensure-panel-dns-a.sh`), the record is added
automatically; otherwise the operator (or the customer) adds it at the
DNS provider.

### Remove a per-domain panel vhost

The script is additive — it never deletes vhosts. To remove one:

```bash
sudo rm /etc/nginx/sites-enabled/qadbak-panel-<slug>.conf
sudo nginx -t && sudo systemctl reload nginx
```

`<slug>` is the customer domain with dots replaced by hyphens
(e.g. `sdconderhoud.nl` → `qadbak-panel-sdconderhoud-nl.conf`). The
file in `sites-available/` can stay; nginx only loads the one in
`sites-enabled/`.

### Cleaning up pre-fix files

Vhosts generated by older versions of this script (before the
`server_name _` / `http2 on` fix) keep producing `[warn] protocol
options redefined` and `[warn] conflicting server name "_"` on every
`scripts/update-qadbak.sh` run. The repair is **manual** — the script
deliberately does not rewrite existing files retroactively. Either:

1. Remove the broken file with the `sudo rm` recipe above and let the
   customer re-click **Apply panel vhost** to regenerate it cleanly, or
2. Re-run `sudo bash scripts/apply-client-panel-vhost.sh <domain>`
   against the same domain — the new script overwrites the file
   end-to-end with the clean template.

## Cloudflare

- **A** record → VPS IP (`QADBAK_ORIGIN_IP` in `.env.local`).
- **Flexible** SSL is fine while origin is HTTP-only on port 80.
- After Let's Encrypt on the server, switch to **Full**.

See also `docs/CLOUDFLARE.md` and `docs/FRONT-DOOR.md`.
