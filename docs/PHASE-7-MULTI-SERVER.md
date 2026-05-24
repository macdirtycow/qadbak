# Phase 7 — Multi-server (foundation)

Independence plan phase 7: **one Qadbak panel, multiple VPS nodes** (ISPConfig-style agents).

## What is in this release

| Piece | Path |
|-------|------|
| Node agent (HTTP) | `scripts/qadbak-node-agent.mjs` → pm2 `qadbak-node-agent` |
| Server registry | `data/servers.json` (from `data/servers.example.json`) |
| Admin UI | `/admin/nodes` |
| API | `GET/POST /api/admin/nodes` |
| Test VPS apply | `scripts/apply-phase7-test-server.sh` |

The panel still provisions domains on the **default node** (usually `local`). Remote nodes are health-checked; full per-domain routing comes in a later iteration.

## Apply on your test VPS

```bash
cd /opt/qadbak
git pull
sudo bash scripts/apply-phase7-test-server.sh
```

Then open **Server admin → Nodes**. Local agent should show **Agent OK**.

## E2E after update

Preflight passed; Playwright needs the panel admin password:

```bash
# Option A — dedicated file (recommended)
sudo nano /opt/qadbak/.install-test.env
```

```env
E2E_ADMIN_USER=admin
E2E_ADMIN_PASS=your-real-panel-password
```

```bash
sudo chown qadbak:qadbak /opt/qadbak/.install-test.env
sudo chmod 600 /opt/qadbak/.install-test.env
sudo bash scripts/run-install-e2e.sh
```

Or set `QADBAK_E2E_ADMIN_PASS=...` in `.env.local` and run `sudo bash scripts/ensure-install-test-env.sh`.

## Second VPS (outline)

1. Clone/pull Qadbak on node 2 (or copy agent script + `.env.local` fragment).
2. Same `QADBAK_NODE_AGENT_TOKEN` as the panel host.
3. Agent listens on `127.0.0.1:9100` — expose via private IP or SSH tunnel from panel.
4. Panel → **Nodes → Add remote node** with `http://OTHER_VPS_IP:9100`.

## Environment

| Variable | Purpose |
|----------|---------|
| `QADBAK_MULTI_SERVER` | `true` — phase 7 enabled |
| `QADBAK_NODE_AGENT_TOKEN` | Bearer token (panel + all agents) |
| `QADBAK_NODE_AGENT_PORT` | Default `9100` |
| `QADBAK_NODE_ID` | This machine’s id (`local` on panel host) |

See [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md) for the full exit criterion (2+ VPS under one panel).
