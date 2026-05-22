# Webmin / VirtualMin embeds (Terminal, Files fallback, Webmin hub)

## Universal behaviour

Embeds use `create-login-link` for **every** domain — no hardcoded hostname. The panel passes `domain=…` and an optional redirect path (`/xterm/index.cgi?user=…`, `/filemin/index.cgi`, etc.).

Webmin is proxied at **`/embed/webmin/`** on the same host/port as Qadbak so Terminal works inside the panel iframe (avoids blank screen from `:10000` cross-origin blocking).

On the VPS after `git pull`:

```bash
sudo bash scripts/install-hosting-stack.sh
# If you use the panel on :11000, refresh that vhost too:
sudo bash scripts/enable-panel-port.sh 11000
sudo bash scripts/sync-webmin-embed-env.sh
sudo -u qadbak bash -c 'cd /opt/qadbak && npm run build'
sudo bash scripts/pm2-restart-qadbak.sh
```

## Error: `Virtual server … has no Webmin login`

The domain was created without the **Webmin** feature. On the VPS:

```bash
sudo bash scripts/enable-domain-webmin-login.sh jouwdomein.nl
```

Or **Repair on server** on Overview (runs `enable-feature --webmin`). New domains get `webmin` automatically.

Qadbak falls back to **Usermin** (domain unix user) for Terminal if Webmin login is still missing.

## Error: `Unknown parameter --redirect-url`

Some VirtualMin versions do not accept `redirect-url` on `create-login-link`. Qadbak then:

1. Creates a login link **without** that parameter  
2. Appends the module path (`page=/xterm/`) to the returned URL  

After `git pull` + `npm run build` + `pm2-restart-qadbak.sh`, Terminal and Webmin modules should open again.

## Test on the VPS

```bash
cd /opt/qadbak && bash scripts/test-login-link.sh jouwdomein.nl
```

You should see an `https://…` URL and no `Unknown parameter`.

## Native vs embed

| Tab | Type |
|-----|------|
| Email, DNS, SSL, Databases, Aliases, Redirects, Cron, PHP, … | Native Qadbak UI (VirtualMin API) |
| Files | Native browser when sudo helper is configured; else Webmin fileman embed |
| Terminal | Webmin xterm embed |
| Webmin | Module launcher (Virtualmin / Usermin screens) |

All tabs are listed for every domain the user may access (RBAC in `src/lib/features.ts`).
