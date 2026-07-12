# server admin / legacy hosting API embeds (Terminal, Files fallback, server admin hub)

> **Independent mode** (`QADBAK_PROVISIONER=native`, fallback off): embeds are disabled. Panel nginx templates omit `/embed/legacy-panel/`. Use native Files and Terminal only. See [PHASE-8-INDEPENDENT.md](./PHASE-8-INDEPENDENT.md).

## Universal behaviour

Embeds use `create-login-link` for **every** domain — no hardcoded hostname. The panel passes `domain=…` and an optional redirect path (`/xterm/index.cgi?user=…`, `/filemin/index.cgi`, etc.).

server admin is proxied at **`/embed/legacy-panel/`** on the same host/port as Qadbak so Terminal works inside the panel iframe. Login uses legacy hosting API **`create-login-link`** (one-time URL) — users should **not** type a server admin password in the panel. If you see a login form, run `configure-legacy-panel-embed.sh` again after `sync-legacy-panel-embed-env.sh`.

Long term, Qadbak replaces server admin screens with native UI (`docs/ROADMAP-NATIVE.md`); legacy hosting API stays the engine on the server, not something clients open.

On the VPS after `git pull`:

```bash
sudo bash scripts/install-hosting-stack.sh
# If you use the panel on :11000, refresh that vhost too:
sudo bash scripts/enable-panel-port.sh 11000
sudo bash scripts/sync-legacy-panel-embed-env.sh
sudo -u qadbak bash -c 'cd /opt/qadbak && npm run build'
sudo bash scripts/pm2-restart-qadbak.sh
```

## Error: `Virtual server … has no server admin login`

The domain was created without the **server admin** feature. On the VPS:

```bash
sudo bash scripts/enable-domain-legacy-login.sh example.com
```

Or **Repair on server** on Overview (runs `enable-feature --legacy-panel`). New domains get `legacy-panel` automatically.

Qadbak falls back to **account panel** (domain unix user) for Terminal if server admin login is still missing.

## Error: `Unknown parameter --redirect-url`

Some legacy hosting API versions do not accept `redirect-url` on `create-login-link`. Qadbak then:

1. Creates a login link **without** that parameter  
2. Appends the module path (`page=/xterm/`) to the returned URL  

After `git pull` + `npm run build` + `pm2-restart-qadbak.sh`, Terminal and server admin modules should open again.

## Test on the VPS

```bash
cd /opt/qadbak && bash scripts/test-login-link.sh example.com
```

You should see an `https://…` URL and no `Unknown parameter`.

## Native vs embed

| Tab | Type |
|-----|------|
| Email, DNS, SSL, Databases, Aliases, Redirects, Cron, PHP, … | Native Qadbak UI (legacy hosting API API) |
| Files | Native browser when sudo helper is configured; else server admin fileman embed |
| Terminal | server admin xterm embed |
| server admin | Module launcher (legacy hosting / account panel screens) |

All tabs are listed for every domain the user may access (RBAC in `src/lib/features.ts`).
