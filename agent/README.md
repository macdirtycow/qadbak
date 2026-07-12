# Qadbak Agent

Standalone Linux agent for the Qadbak iOS app. **Work in progress — beta.**

## Status

| Phase | State |
|-------|-------|
| 1 — iOS model, docs, provider abstraction | Done |
| 2 — Agent binary + SSH onboarding + dashboard | Done (beta) |
| 3 — Read-only services/docker/logs | Done (beta) |
| 4 — Writes: restart, updates, reboot | Done (beta) |
| 5 — Panel detection badges, notifications | Planned |

## Documentation

- [Architecture](../docs/agent/ARCHITECTURE.md)
- [Security](../docs/agent/SECURITY.md)
- [API](../docs/agent/API.md)
- [Installation](../docs/agent/INSTALLATION.md)
- [Supported systems](../docs/agent/SUPPORTED_SYSTEMS.md)
- [Threat model](../AGENT_THREAT_MODEL.md)
- [iOS integration](../docs/ios/EXTERNAL_SERVERS.md)

## Not the same as

`scripts/qadbak-node-agent.mjs` — legacy multi-server proxy for Qadbak panels. That agent remains for panel admins; this project is a new standalone binary.

## Source layout (phase 2+)

```
agent/
  cmd/qadbak-agent/
  internal/auth/
  internal/handlers/
  internal/privilege/
  packaging/deb/
```

Source code lands in phase 2.
