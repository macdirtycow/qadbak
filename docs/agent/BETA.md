# Qadbak Agent — Closed Beta

Phase 6 hardening for a limited external beta of the Linux agent + iOS onboarding flow.

## Scope

| Area | Beta behaviour |
|------|----------------|
| OS | Debian 12, Ubuntu 22.04 / 24.04 only |
| Architectures | amd64, arm64 |
| Install | iOS SSH onboarding or manual `packaging/install.sh` |
| Daemon | Runs as `qadbak-agent` (non-root) |
| Privilege | `qadbak-agent priv …` via passwordless sudoers drop-in |
| Transport | HTTPS + pinned TLS fingerprint |
| SSH | Host key pinned after first connect |
| Releases | SHA-256 manifest bundled in iOS + `dist/manifest.json` |

## What we hardened

1. **Non-root service** — systemd unit runs as `qadbak-agent`; writes go through `priv` subcommand only.
2. **JWT secret file** — `/etc/qadbak-agent/jwt.secret` (640, root:qadbak-agent) instead of dev default.
3. **Sudoers** — single NOPASSWD rule for `qadbak-agent priv *`, validated with `visudo -cf`.
4. **Install manifest** — iOS verifies bundled binary SHA-256 before upload.
5. **Version gates** — agent exposes `minAppVersion`; app checks agent version after pairing.
6. **Token revoke** — `POST /api/v1/auth/revoke` when removing a server from the app.
7. **CodeQL** — Go + JavaScript in CI security workflow.

## Build agent for iOS

```bash
bash scripts/copy-agent-to-ios.sh
```

This produces `agent/dist/*` and copies binaries + `manifest.json` into `ios/Qadbak/Resources/Agent/`.

## Manual VPS install

```bash
bash agent/scripts/build-release.sh
sudo bash agent/packaging/install.sh agent/dist/qadbak-agent-linux-amd64
```

Pair from **Servers → Add server → Linux via SSH** (or reuse pairing token within 10 minutes).

## Beta limitations

- Self-signed TLS only (no ACME yet)
- No minisign/cosign on release artifacts yet — checksum manifest only
- SSH password auth only during onboarding (key auth planned)
- Local notifications only (no push from agent)
- Single device refresh tokens per pairing rotation

## Reporting issues

Use GitHub issues with:

- OS + version (`/etc/os-release`)
- Agent version (`GET /api/v1/version`)
- iOS app version
- Redacted audit log excerpt from `/var/lib/qadbak-agent/logs/audit.log` if relevant

## Rollback

```bash
sudo systemctl disable --now qadbak-agent
sudo rm -f /etc/sudoers.d/qadbak-agent /usr/local/bin/qadbak-agent
sudo rm -rf /usr/lib/qadbak-agent
# Optional: remove user/data
sudo userdel qadbak-agent 2>/dev/null || true
sudo rm -rf /var/lib/qadbak-agent /etc/qadbak-agent
```

Does not modify Hestia, Coolify, Plesk, or other panels.
