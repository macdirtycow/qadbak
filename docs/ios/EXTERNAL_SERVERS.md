# iOS — External Linux Servers

Integration of non-Qadbak Linux servers into the existing Qadbak iOS app.

## Server types

One unified model: `ManagedServer` (see `ios/Qadbak/Models/ManagedServer.swift`).

| Type | Auth | UI after connect |
|------|------|------------------|
| Qadbak panel | Mobile JWT (`/api/auth/mobile`) | Domain list (unchanged) |
| Linux + agent | Agent JWT after SSH pairing | Agent dashboard (capability-based) |

## Provider abstraction

```swift
protocol ServerManagementProvider {
    var server: ManagedServer { get }
    func fetchOverview() async throws -> ServerOverview
    // … capability-gated methods
}
```

Implementations:

- `QadbakPanelProvider` — wraps existing `QadbakAPI`
- `QadbakAgentProvider` — HTTPS to agent (phase 2+)

Views must **not** branch on `ServerKind` for feature visibility — use `server.capabilities`.

## Adding a server

**Servers → Add server**

1. Connect existing Qadbak server → existing `LoginView`
2. Connect Linux server via SSH → `LinuxServerOnboardingView` (phase 2)

## Keychain

| Key | Content |
|-----|---------|
| `managedServers` | JSON array of profiles |
| `refreshToken.<id>` | Panel refresh token |
| `agentRefreshToken.<id>` | Agent refresh token |
| `agentTlsPin.<id>` | SHA-256 SPKI pin |
| `sshHostKey.<id>` | Verified SSH fingerprint |

Never store SSH passwords.

## Migration

On first launch after update, `KeychainStore.migrateToManagedServersIfNeeded()` converts legacy `SavedServer` entries to `ManagedServer` with:

- `serverKind = .qadbakPanel`
- `authenticationMethod = .qadbakMobileAuth`
- `capabilities.domainHosting = true`

Existing users see no behaviour change.

## Connection states

`ConnectionStatus`: connecting, installingAgent, pairing, online, degraded, offline, authFailed, agentUpdateRequired, unsupportedOS.

Show concrete progress during onboarding — not only spinners.

## Beta disclaimer

Shown before first Linux server add:

- Agent can reboot services and the host
- Use a test server first
- Ensure backups exist
- Panel badges are informational

## Phase 1 deliverables (this release)

- [x] `ManagedServer` model
- [x] Provider protocols + panel provider
- [x] Agent provider stub
- [x] Keychain migration
- [x] Server badges in switcher
- [x] Add server choice screen

## Phase 2 deliverables

- [x] Go agent (`agent/cmd/qadbak-agent`) — health, version, pairing, overview
- [x] TLS + JWT auth + refresh rotation
- [x] iOS `AgentAPIClient` with certificate pinning
- [x] 5-step SSH onboarding (`LinuxServerOnboardingView`)
- [x] Agent dashboard with CPU/RAM/disk/uptime
- [x] Bundled Linux agent binaries (`Resources/Agent/`)
- [x] Citadel SPM for SSH

### Build agent binaries for iOS

```bash
bash scripts/copy-agent-to-ios.sh
```

### Xcode

1. Open `ios/Qadbak.xcodeproj`
2. Resolve Swift packages (Citadel)
3. Build on device (SSH requires real network)

### Manual agent test (VPS)

```bash
sudo ./agent/dist/qadbak-agent-linux-amd64 -listen 0.0.0.0:9443 -data-dir /var/lib/qadbak-agent
curl -sk https://127.0.0.1:9443/health
```

## Phase 3 deliverables

- [x] `GET /api/v1/services` — systemd units (read-only)
- [x] `GET /api/v1/docker/containers` — Docker list (when available)
- [x] `GET /api/v1/logs` — journal + service logs (sanitized)
- [x] Capabilities: `logs`, `serviceManagement`, `dockerManagement` (auto-detect)
- [x] iOS: Services, Docker, Logs screens from agent dashboard
- [x] Capability refresh on dashboard load (upgrade path for paired servers)

## Phase 4 deliverables

- [x] Confirmation JWT flow (`POST /api/v1/actions/confirm` + `X-Qadbak-Confirm`)
- [x] Service start/stop/restart via systemctl
- [x] Docker container start/stop/restart
- [x] apt update check + controlled upgrade
- [x] Reboot & shutdown (confirmed)
- [x] Audit log (`data/logs/audit.log` on agent)
- [x] iOS: action menus on Services/Docker + Control screen

## Phase 5 deliverables

- [x] Dual badges: Linux Agent + detected panel (Hestia, Coolify, …)
- [x] Panel detection card on agent dashboard (signals, confidence)
- [x] Background health polling every 5 minutes
- [x] Local notifications: offline, high CPU, failed services, pending updates
- [x] Settings toggle for agent alerts
