# Qadbak Agent — Threat Model

Security-critical infrastructure software. This document describes assets, trust boundaries, threats, and mitigations for the **standalone Qadbak Agent** and the **iOS external-server onboarding flow**.

## Scope

| In scope | Out of scope (v1) |
|----------|-------------------|
| Agent API on Linux VPS | Full panel takeover of Hestia/Coolify/Plesk |
| iOS pairing via SSH (one-time) | Arbitrary remote shell from iOS |
| Token-based agent auth | Shared-secret node agent (`qadbak-node-agent.mjs`) |
| systemd / Docker / apt allowlist | File browser, firewall UI |

## Assets

1. **SSH credentials** (temporary, onboarding only)
2. **Agent access / refresh tokens** (per server, per device)
3. **TLS certificate pins** (agent identity)
4. **Server identity keypair** (agent-generated)
5. **Audit logs** (on server)
6. **iOS Keychain entries**

## Trust boundaries

```
┌─────────────┐   TLS + pinned cert    ┌──────────────┐
│  Qadbak iOS │ ◄────────────────────► │ qadbak-agent │
└──────┬──────┘                        └──────┬───────┘
       │ SSH (onboarding / recovery only)      │ Unix socket
       └──────────────────────────────────────►│ privilege helper
                                                └──────► systemctl, docker, apt
```

The iOS app **must not** trust UI hiding alone. Every sensitive action is re-validated on the agent.

## STRIDE summary

| Category | Example | Mitigation |
|----------|---------|------------|
| Spoofing | Fake agent, MITM | TLS required; cert fingerprint shown at pairing; pin stored in Keychain |
| Tampering | Modified API responses | HTTPS; optional request signing (phase 4+) |
| Repudiation | Denied reboot | Append-only audit log on agent |
| Information disclosure | Token in logs | Keychain only; redact secrets; no password persistence |
| Denial of service | Restart spam | Rate limits; confirmation tokens for destructive ops |
| Elevation | Shell injection | No `shell: true`; absolute binary paths; argument validation; sudo allowlist |

## Attack scenarios

### A1 — Stolen refresh token

**Impact:** Attacker controls server until revocation.  
**Mitigation:** Short access TTL (15m), refresh rotation, server-side revocation list, optional device binding claim in JWT.

### A2 — Compromised iOS device

**Impact:** Keychain extraction when unlocked.  
**Mitigation:** `WhenUnlockedThisDeviceOnly`, optional Face ID gate (existing `AppLockView`), no SSH password stored.

### A3 — MITM during pairing

**Impact:** Wrong agent impersonation.  
**Mitigation:** SSH host-key verification; display fingerprint; user must confirm agent TLS pin before saving server.

### A4 — Command injection via API

**Impact:** Remote code execution as root.  
**Mitigation:** Allowlisted actions only; `execFile` style execution; validate service names / container IDs with strict regex; no user-controlled shell strings.

### A5 — Docker socket exposure

**Impact:** Container escape → host root.  
**Mitigation:** Docker socket never exposed to network; only helper invokes `/usr/bin/docker` with validated subcommands.

### A6 — Malicious log content

**Impact:** UI confusion, injection in SwiftUI.  
**Mitigation:** Strip ANSI; length limits; no HTML rendering of raw logs.

### A7 — Downgrade to old vulnerable agent

**Impact:** Known CVE exploitation.  
**Mitigation:** App enforces `minAgentVersion`; pairing refused below threshold; signed updates only.

## Agent privileges (least privilege)

| Action | Privilege | Validation |
|--------|-----------|------------|
| Read metrics | agent user + `/proc` | read-only |
| List services | `systemctl list-units` | no write |
| Restart service | sudo → allowlisted unit names | regex + allowlist file |
| Docker list | docker group or sudo | read-only subcommands |
| Docker restart | sudo → container ID | `^[a-f0-9]{12,64}$` |
| apt upgrade | sudo → fixed script | no arbitrary packages |
| reboot/shutdown | sudo + confirmation JWT | single-use, 60s TTL |

## What the agent must never do

- Execute arbitrary shell commands from API input
- Modify third-party panel configuration (Hestia, Coolify, Plesk, DirectAdmin)
- Run as root in the main daemon process
- Accept TLS connections without user-approved pin (first pairing)
- Store SSH passwords on disk
- Log tokens, keys, or passwords

## Residual risks (accepted for beta)

- Self-signed TLS until user installs proper cert (pin mitigates MITM after first trust)
- Panel detection false positives (informational only)
- Push notifications via polling in MVP (delayed alerts)
- Single-device revocation may lag until agent restart

## Review cadence

Revisit this model before:
- Enabling write actions (phase 4)
- Public beta
- Adding new API endpoints outside the allowlist
