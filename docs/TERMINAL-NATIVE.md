# Native terminal (no Webmin)

The **Terminal** tab runs **bash** as the domain’s unix user (`/home/USER`), inside Qadbak. No Webmin login, no `:10000` iframe.

## Architecture

```
Browser (xterm.js) ←WebSocket→ nginx /ws/domain-terminal → qadbak-terminal (:3001)
                                                      ↓
                                            sudo run-domain-terminal.sh USER
                                                      ↓
                                            /bin/bash -l in /home/USER
```

## Server setup (after `git pull`)

```bash
cd /opt/qadbak
sudo bash scripts/install-node-build-deps.sh   # make/g++ for node-pty (once)
sudo bash scripts/fix-qadbak-ownership.sh     # if you ran npm install as root before
sudo -u qadbak bash -c 'cd /opt/qadbak && npm install && npm run build'
sudo bash scripts/configure-domain-terminal-sudo.sh
sudo bash scripts/enable-panel-port.sh 11000   # if you use :11000
sudo bash scripts/apply-hosting-nginx.sh       # WebSocket proxy in nginx
sudo bash scripts/pm2-restart-qadbak.sh
sudo -u qadbak pm2 list
```

**Do not** run `npm install` as root — `node-pty` must compile as the `qadbak` user and needs `build-essential` on Ubuntu.

`pm2` must show **qadbak** and **qadbak-terminal** online.

## Verify

```bash
pm2 list
curl -sI http://127.0.0.1:11000/ws/domain-terminal
# Expect 426 Upgrade Required (normal without WebSocket client)

sudo -u qadbak sudo -n /opt/qadbak/scripts/run-domain-terminal.sh YOUR_UNIX_USER
# Should drop into bash (Ctrl+D to exit)
```

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `QADBAK_TERMINAL_WS_PORT` | `3001` | WebSocket server bind port |
| `QADBAK_TERMINAL_WS_HOST` | `127.0.0.1` | Bind address |
| `QADBAK_NATIVE_TERMINAL` | on | Set `false` to disable |

## Security

- Only users with Qadbak access to the domain get a short-lived WS token (2 minutes).
- Shell runs as the VirtualMin domain unix user, home under `/home/`.
- Sudo rule allows only `run-domain-terminal.sh <user>`.

## Local dev

With `VIRTUALMIN_MOCK=true`, the WS server spawns a local bash (no sudo).
