# Qadbak Agent — Supported Systems

## Beta tier (v1)

Fully tested target platforms:

| Distribution | Version | Notes |
|--------------|---------|-------|
| Debian | 12 (bookworm) | Primary reference |
| Ubuntu | 22.04 LTS (jammy) | |
| Ubuntu | 24.04 LTS (noble) | |

Architectures: **amd64**, **arm64**.

## Panel detection (informational)

The agent **detects but does not manage** these panels in v1:

| Panel | Detection signals |
|-------|-------------------|
| Qadbak | `/opt/qadbak`, pm2, panel health URL |
| HestiaCP | `/usr/local/hestia`, `hestia` service |
| Coolify | Coolify Docker containers, `/data/coolify` |
| CasaOS | `casaos.service` |
| Plesk | `/usr/local/psa` |
| DirectAdmin | `/usr/local/directadmin` |

UI shows badge only — no claim of full panel integration unless capability is set.

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
