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

The unix user comes from `data/native-domains.json` (or `/home/*/.qadbak-domain`) via `resolveDomainUnixUser` — works in **independent** mode without VirtualMin.

## Two terminals

| Where | Who | WebSocket |
|-------|-----|-----------|
| **Server admin → Terminal** | `root` bash (admins only) | `/ws/admin-terminal` |
| **Domains → … → Terminal** | Domain unix user (e.g. `example`) | `/ws/domain-terminal` |

Domain terminal starts in `/tmp` then `run-domain-terminal.sh` cds to the user home (avoids permission denied on private `/home/user` dirs).

## Server setup (after `git pull`)

```bash
cd /opt/qadbak
sudo bash scripts/pull-and-helpers.sh   # pull + apply-terminal-native
sudo -u qadbak bash -c 'cd /opt/qadbak && npm run build'
# or one-shot without pull:
sudo bash scripts/apply-terminal-native.sh
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
