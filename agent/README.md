# Qadbak Agent

Standalone Linux agent for the Qadbak iOS app. **Beta** (v0.5.0).

Runs on Debian 12 and Ubuntu 22.04 / 24.04 (amd64, arm64). Listens on **9443/tcp** (HTTPS, self-signed cert + fingerprint pinning).

## What it does

- System metrics, systemd services, Docker, logs, apt updates, reboot/shutdown
- SSH onboarding from the iOS app (install + pair)
- Detects HestiaCP, Coolify, CasaOS, Plesk, DirectAdmin, Qadbak on the host
- **Panel linking (v0.5.0):** read-only API access for HestiaCP, Coolify, CasaOS

It does **not** replace those panels. Domain and mail management still need the Qadbak panel or the panel's own UI.

## Status

| Phase | State |
|-------|-------|
| 1: iOS model, provider abstraction | Done |
| 2: Agent binary, SSH onboarding | Done (beta) |
| 3: Services, Docker, logs (read) | Done (beta) |
| 4: Restart, updates, reboot | Done (beta) |
| 5: Panel badges, local alerts | Done (beta) |
| 6: Hardening, JWT secret, manifest verify | Done (beta) |
| 7: SSH keys, re-pair, upgrade, metrics, audit | Done (beta) |
| 8: OSS panel linking (Hestia, Coolify, CasaOS) | Done (beta, read-only) |

## Quick install

```bash
# After building or downloading qadbak-agent-linux-amd64
sudo bash agent/packaging/install.sh ./qadbak-agent-linux-amd64
```

Or use **Servers → Linux server via SSH** in the iOS app.

## Documentation

- [Architecture](../docs/agent/ARCHITECTURE.md)
- [Installation](../docs/agent/INSTALLATION.md)
- [API](../docs/agent/API.md)
- [Panel linking](../docs/agent/PANEL-LINKING.md)
- [Supported systems](../docs/agent/SUPPORTED_SYSTEMS.md)
- [Security](../docs/agent/SECURITY.md)
- [Beta program](../docs/agent/BETA.md)
- [iOS integration](../docs/ios/EXTERNAL_SERVERS.md)
- [Threat model](../AGENT_THREAT_MODEL.md)

## Not the same as

`scripts/qadbak-node-agent.mjs` is the legacy multi-server proxy for Qadbak **panel** admins. The Go agent in `agent/` is a separate binary for external Linux servers.

## Source layout

```
agent/
  cmd/qadbak-agent/       Main binary
  internal/auth/          JWT, pairing, refresh tokens
  internal/handlers/      HTTP API
  internal/panels/        Hestia, Coolify, CasaOS clients
  internal/privilege/     Non-root writes via priv subcommand
  packaging/install.sh    Systemd install script
```

Build:

```bash
cd agent && go build -o qadbak-agent ./cmd/qadbak-agent
bash scripts/copy-agent-to-ios.sh   # embed in iOS app bundle
```
