# License server on license.omiiba.dev

The license API is a **small Node service** in the private `qadbak-premium` repo (`license-server/`). Panel installs talk to it over HTTPS; you do **not** need the full Qadbak UI on the same host unless you also want to host sites there.

## Architecture

| Host | Role |
|------|------|
| **license.omiiba.dev** | License API only (activate, heartbeat, Premium artifact download) |
| **Your panel VPS** (e.g. siccamanagement, main server) | Qadbak panel + `QADBAK_LICENSE_SERVER=https://license.omiiba.dev` |

`QADBAK_LICENSE_JWT_SECRET` on every panel must match `LICENSE_JWT_SECRET` on the license server.

## 1. DNS and TLS

Point `license.omiiba.dev` A/AAAA to the server that runs the API (often your **main** server).

```bash
sudo certbot certonly --nginx -d license.omiiba.dev
```

## 2. Deploy the license server (no full Qadbak required)

On the license host:

```bash
git clone git@github.com:macdirtycow/qadbak-premium.git /opt/qadbak-premium
cd /opt/qadbak-premium/license-server
npm install
export LICENSE_JWT_SECRET="$(openssl rand -base64 32)"
export LICENSE_ADMIN_TOKEN="$(openssl rand -hex 24)"
npm run init-db
```

Save secrets (password manager). Create a systemd unit or pm2 app:

```bash
# Example: pm2 as dedicated user
pm2 start src/server.mjs --name qadbak-license --cwd /opt/qadbak-premium/license-server
pm2 save
```

## 3. nginx reverse proxy

```nginx
server {
    listen 443 ssl http2;
    server_name license.omiiba.dev;

    ssl_certificate     /etc/letsencrypt/live/license.omiiba.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/license.omiiba.dev/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 64m;
    }
}
```

Test: `curl -sS https://license.omiiba.dev/health`

## 4. Generate a license key

```bash
curl -sS -X POST https://license.omiiba.dev/v1/admin/keys \
  -H "Authorization: Bearer $LICENSE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro","features":["client-rbac","multi-tenant-clients","panel-client-vhost","admin-updates","php-fpm-isolation","dashboard-panel-control"],"maxDomains":50,"expiresAt":"2027-12-31T00:00:00.000Z","customerEmail":"you@example.com"}'
```

## 5. Upload Premium artifacts

From a build machine with `qadbak-premium` cloned:

```bash
export LICENSE_SERVER=https://license.omiiba.dev
export LICENSE_ADMIN_TOKEN=<same as server>
npm run build:release
```

Artifacts land in `license-server/data/artifacts/` on the license host.

## 6. Configure each Qadbak panel

In `/opt/qadbak/.env.local` on every panel VPS:

```env
QADBAK_LICENSE_SERVER=https://license.omiiba.dev
QADBAK_LICENSE_JWT_SECRET=<same as LICENSE_JWT_SECRET on license server>
```

Restart panel, then **Server admin → License** → activate key → **Refresh modules**.

Or CLI:

```bash
sudo -u qadbak node /opt/qadbak/scripts/qadbak-license-cli.mjs activate YOUR-KEY
sudo -u qadbak node /opt/qadbak/scripts/qadbak-license-cli.mjs sync
```

## Test on siccamanagement first (local license server)

`license.omiiba.dev` can stay offline until DNS is ready. On the **siccamanagement** VPS:

```bash
cd /opt/qadbak
sudo bash scripts/git-sync-origin.sh
sudo bash scripts/setup-local-license-server.sh
sudo bash scripts/test-license-flow.sh
```

This runs the license API on `http://127.0.0.1:8787`, writes matching secrets to `/opt/qadbak/.env.local`, activates a test key, and restarts the panel. When satisfied, deploy the same `license-server` on main behind `https://license.omiiba.dev` and change only `QADBAK_LICENSE_SERVER` on each panel.

## Should you install Qadbak on the main server?

| Goal | Install full Qadbak on main? |
|------|------------------------------|
| Only run licensing for other panels | **No** — deploy `license-server` only on `license.omiiba.dev` |
| Host customer domains on main + use Premium | **Yes** — full install + same `.env.local` license vars |
| Test server (siccamanagement) already works | Keep test VPS; point it at `license.omiiba.dev` |

Recommended order:

1. Deploy license server on main (or a small dedicated VPS) at **license.omiiba.dev**.
2. Point **siccamanagement** test panel at it; activate and sync Premium.
3. Install Qadbak on main **when** you are ready to move production hosting there.

See also [COMMERCIAL.md](./COMMERCIAL.md) and `qadbak-premium/license-server/README.md`.
