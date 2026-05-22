# Production deploy (Fase 0)

Deploy Qadbak on the same VPS as VirtualMin. **Qadbak must be the front door on ports 80/443** (IP and hostname). VirtualMin/Webmin stays on **:10000** for the API and embeds — not as the page users see first.

**First deploy:** use a [dedicated test VPS](V1-TEST-SERVER.md), not production.  
See [FRONT-DOOR.md](FRONT-DOOR.md) · [STATUS.md](STATUS.md).

## Prerequisites

- Ubuntu 22.04 with VirtualMin 8.x and Remote API enabled
- Node.js 20+
- nginx, certbot, pm2 (`npm install -g pm2`)
- DNS for panel hostname → server IP

## 1. Clone and build

```bash
git clone https://github.com/macdirtycow/qadbak.git
cd qadbak
cp .env.example .env.local
```

Edit `.env.local`:

```env
SESSION_SECRET=<openssl rand -base64 32>
VIRTUALMIN_MOCK=false
VIRTUALMIN_URL=https://127.0.0.1:10000/virtual-server/remote.cgi
VIRTUALMIN_USER=root
VIRTUALMIN_PASS=<webmin-root-password>
WEBMIN_UI_URL=https://panel-test.yourdomain.com:10000
USERMIN_UI_URL=https://panel-test.yourdomain.com:20000
VIRTUALMIN_UI_URL=https://panel-test.yourdomain.com:10000
PORT=3000
```

If self-signed TLS on 10000 (VirtualMin API only — not global):

```env
VIRTUALMIN_TLS_INSECURE=true
```

Do **not** set `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables TLS for the entire Node process). See `docs/PRODUCTION-HARDENING.md`.

## 2. Verify API

```bash
npm install
npm run test-api
```

## 3. Panel users

```bash
node scripts/hash-password.mjs 'your-strong-password'
# Edit data/users.json — set admin passwordHash
```

## 4. Run with pm2

```bash
bash scripts/deploy-pm2.sh
```

Or manually:

```bash
npm run build
pm2 start npm --name qadbak -- start
pm2 save
pm2 startup
```

## 5. nginx + TLS (IP → Qadbak, not VirtualMin)

```bash
PANEL=qadbak.com          # or your server FQDN, e.g. mareades.com
FQDN=$(hostname -f)
sed -e "s/__PANEL_HOST__/$PANEL/g" -e "s/__SERVER_FQDN__/$FQDN/g" \
  deploy/nginx-qadbak.conf | sudo tee /etc/nginx/sites-available/qadbak
sudo ln -sf /etc/nginx/sites-available/qadbak /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d "$PANEL" -d "$FQDN"
```

- `http://SERVER_IP:11000/` → Qadbak panel (if `enable-panel-port.sh` was run)
- `http://customer-domain/` → Apache / `public_html` (nginx `default_server` → Apache backend)
- `https://panel-host/` → Qadbak
- `https://$PANEL/login` → Qadbak
- `https://$FQDN:10000` → Webmin only (do not use as client entry URL)

Remove any static `index.html` in `public_html` that blocks the proxy.

## 6. Smoke test

| Check | URL |
|-------|-----|
| Marketing | `https://<panel>/` |
| Login | `https://<panel>/login` |
| API | `npm run test-api` |
| Domains | Login → Domains list matches VirtualMin |

## Update

```bash
git pull
npm install
npm run build
pm2 restart qadbak
```
