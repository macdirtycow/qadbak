# Production deploy (Fase 0)

Deploy Qadbak/Qadbak on the same VPS as VirtualMin (e.g. mareades.com).

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
WEBMIN_UI_URL=https://mareades.com:10000
USERMIN_UI_URL=https://mareades.com:20000
VIRTUALMIN_UI_URL=https://mareades.com:10000
PORT=3000
```

If self-signed TLS on 10000:

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

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

## 5. nginx + TLS

```bash
sudo cp deploy/nginx-qadbak.conf /etc/nginx/sites-available/qadbak
# Edit PANEL_HOSTNAME in the file to your panel hostname
sudo ln -sf /etc/nginx/sites-available/qadbak /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d qadbak.com -d www.qadbak.com
```

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
