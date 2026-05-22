# Webmin / VirtualMin embeds (Terminal, Files fallback, Webmin hub)

## Universal behaviour

Embeds use `create-login-link` for **every** domain — no hardcoded hostname. The panel passes `domain=…` and an optional redirect path (`/xterm/`, `/filemin/index.cgi`, etc.).

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
