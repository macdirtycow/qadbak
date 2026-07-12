# Qadbak Agent — Supported Systems

## Beta tier (v1)

Fully tested target platforms:

| Distribution | Version | Notes |
|--------------|---------|-------|
| Debian | 12 (bookworm) | Primary reference |
| Ubuntu | 22.04 LTS (jammy) | |
| Ubuntu | 24.04 LTS (noble) | |

Architectures: **amd64**, **arm64**.

## Panel detection and linking

The agent **detects** these panels on the host:

| Panel | Detection | Agent link (read-only) |
|-------|-----------|------------------------|
| Qadbak | `/opt/qadbak` | Use the Qadbak **panel URL** in the iOS app instead |
| HestiaCP | `/usr/local/hestia` | Yes — API login or access key |
| Coolify | `/data/coolify` | Yes — API token |
| CasaOS | `casaos.service` | Yes — token or login |
| Plesk | `/usr/local/psa` | Detected only (not yet) |
| DirectAdmin | `/usr/local/directadmin` | Detected only (not yet) |

Linking stores credentials on the server and exposes summaries via `/api/v1/panels/overview`.
See [PANEL-LINKING.md](./PANEL-LINKING.md).

## Explicitly unsupported (initial)

- RHEL / CentOS / Alma (future)
- Alpine (musl / OpenRC)
- Windows, macOS server
- Shared hosting without SSH root/sudo

## iOS requirements

- iOS 17+
- Qadbak app with external servers beta flag enabled

## Agent resource budget

Target:

- Binary size: &lt; 20 MB
- Idle RAM: &lt; 30 MB
- No embedded database (SQLite optional for audit only)
