# Qadbak Agent — Architecture

Standalone Linux agent for remote system management from the Qadbak iOS app. **Not** a full Qadbak panel install.

## Relationship to existing components

| Component | Role |
|-----------|------|
| **Qadbak panel** | Full hosting stack; mobile auth via `/api/auth/mobile` |
| **`scripts/qadbak-node-agent.mjs`** | Phase-7 multi-server legacy proxy; stays unchanged |
| **New `qadbak-agent`** | Generic Linux management; installed via SSH onboarding |

These are **parallel** systems. Convergence is optional future work.

## High-level design

```
┌─────────────────────────────────────────────────────────────┐
│ qadbak-agent (systemd: qadbak-agent.service)                │
│  User: qadbak-agent                                         │
│  Listen: 127.0.0.1:9443 or configured bind + TLS            │
├─────────────────────────────────────────────────────────────┤
│ HTTP router  /api/v1/*                                      │
│ Auth         JWT access + opaque refresh + pairing tokens   │
│ Rate limit   per-IP / per-token                             │
│ Audit        JSON lines → /var/log/qadbak-agent/audit.log   │
├─────────────────────────────────────────────────────────────┤
│ Handlers                                                    │
│  system/     overview, metrics, reboot, shutdown            │
│  services/   list, start, stop, restart (allowlist)         │
│  docker/     containers, logs, lifecycle (validated IDs)    │
│  logs/       journal + file tail (sanitized)                │
│  updates/    apt check / install (controlled)               │
│  pairing/    one-time bootstrap                             │
│  detection/  read-only panel fingerprint                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ Unix socket / setuid helper
┌───────────────────────────▼─────────────────────────────────┐
│ qadbak-agent-helper                                           │
│  sudoers: fixed commands only                                 │
└───────────────────────────────────────────────────────────────┘
```

## Runtime choice

**Go** (recommended): single static binary, small footprint, good `exec` control, cross-compile for `amd64`/`arm64`.

## Configuration

Minimal file: `/etc/qadbak-agent/config.yaml`

```yaml
listen: "127.0.0.1:9443"
tls_cert: "/var/lib/qadbak-agent/tls.crt"
tls_key: "/var/lib/qadbak-agent/tls.key"
data_dir: "/var/lib/qadbak-agent"
audit_log: "/var/log/qadbak-agent/audit.log"
min_pairing_ttl_seconds: 300
```

Secrets (refresh token hashes) live under `data_dir` with `0600` permissions.

## iOS integration

```
AppState
  └── ServerProviderFactory
        ├── QadbakPanelProvider  → QadbakAPI (existing)
        └── QadbakAgentProvider  → AgentAPIClient (TLS pin + JWT)
```

UI uses **capabilities** from `GET /api/v1/capabilities` — not hardcoded server type checks.

## Implementation phases

| Phase | Deliverable |
|-------|-------------|
| 1 | iOS model, provider protocols, docs, threat model |
| 2 | Agent skeleton: health, version, pairing, overview |
| 3 | Read-only: metrics, services, docker, logs |
| 4 | Writes: restart, updates, reboot (confirmed) |
| 5 | Panel detection badges, notifications |
| 6 | Hardening, signed releases, closed beta |

See `docs/ios/EXTERNAL_SERVERS.md` for the mobile side.
