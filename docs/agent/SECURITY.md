# Qadbak Agent — Security

## Transport

- **TLS required** for all agent API traffic after pairing.
- First boot: agent generates self-signed certificate; iOS displays SHA-256 fingerprint; user must confirm.
- Pin stored in iOS Keychain (`agentTlsPin.<serverId>`). No silent trust of unknown CAs.
- Optional later: user-provided cert or ACME.

## Authentication

| Token | Lifetime | Storage |
|-------|----------|---------|
| Pairing | 5 minutes | Agent memory only |
| Access JWT | 15 minutes | iOS Keychain |
| Refresh | 90 days | Agent hashed store + iOS Keychain |
| Action confirmation | 60 seconds | For reboot / shutdown / bulk restart |

Refresh rotation on every use (same pattern as `src/lib/mobile-auth.ts`).

## SSH onboarding (iOS)

SSH is used **only** for:

- System detection
- Agent installation
- Recovery / reinstall

Rules:

- Validate hostname, IP, port (1–65535), username charset
- Verify SSH host key; store fingerprint in Keychain
- Prefer SSH **key** auth; passwords kept in memory only for the session
- Never persist plaintext SSH passwords
- Install script receives parameters via environment / temp files — **no** string interpolation of user input into shell

## Privilege helper

Main daemon runs as `qadbak-agent` (non-root).

`/etc/sudoers.d/qadbak-agent` grants **specific** commands only, e.g.:

```
qadbak-agent ALL=(root) NOPASSWD: /usr/lib/qadbak-agent/helper systemctl-restart *
```

Helper validates:

- Service name against allowlist regex (`^[a-zA-Z0-9@._-]+$`)
- Container ID against `^[a-f0-9]{12,64}$`
- No shell invocation (`execve` direct)

## API allowlist

No generic `/exec` endpoint. Each action has:

- Dedicated route
- Input schema
- Authorization scope (capability flag)
- Rate limit
- Audit log entry

## Updates

- Releases signed (minisign or cosign)
- Agent verifies signature + checksum before replacing binary
- Previous version kept for rollback
- Pin agent version in install manifest

## Logging

Never log:

- Passwords
- Private keys
- Bearer tokens
- SSH session data

Audit log records: timestamp, action, subject (token id), result, source IP.

## Incident response

1. Revoke refresh token via agent CLI or API
2. Rotate `QADBAK_AGENT_*` install credentials
3. Remove `/etc/sudoers.d/qadbak-agent` and uninstall package
4. Review `/var/log/qadbak-agent/audit.log`

See `AGENT_THREAT_MODEL.md` for full threat analysis.
