# Qadbak Agent — Installation

## Supported systems (beta)

| OS | Version | Architectures |
|----|---------|---------------|
| Debian | 12 (bookworm) | amd64, arm64 |
| Ubuntu | 22.04 LTS, 24.04 LTS | amd64, arm64 |

Other distributions: blocked until tested.

## Prerequisites

- `sudo` access for the installing SSH user
- Outbound HTTPS for release download (during install)
- Open port **9443/tcp** (or chosen port) if the phone must reach the agent directly
- Recommended: test server, not production-critical host

## iOS flow (preferred)

1. **Servers → Add server → Connect Linux server via SSH**
2. Enter name, host, port, username
3. Authenticate with SSH key (recommended) or temporary password
4. Review detection results (OS, arch, sudo, panel if any)
5. Confirm install manifest
6. App installs agent, completes pairing, drops SSH session

## Manual install (recovery)

```bash
# Example — exact commands will ship with signed .deb in phase 2
curl -fsSL https://releases.example/qadbak-agent_1.0.0_amd64.deb -o /tmp/qadbak-agent.deb
sha256sum -c qadbak-agent_1.0.0_amd64.deb.sha256
sudo dpkg -i /tmp/qadbak-agent.deb
sudo systemctl enable --now qadbak-agent
```

Pair from iOS using **Reconnect → Pair with existing agent**.

## Idempotency

Re-running install:

- Same version → no-op, refresh systemd unit if needed
- Newer version → upgrade with signature check
- Failure → rollback binary + restore previous unit

## Uninstall

```bash
sudo systemctl disable --now qadbak-agent
sudo dpkg -r qadbak-agent
sudo rm -f /etc/sudoers.d/qadbak-agent
```

Does **not** remove Hestia, Coolify, Plesk, or other panels.

## Firewall

If agent binds only to `127.0.0.1`, use VPN/WireGuard or SSH tunnel for remote access.  
If binding to a public interface, restrict with UFW to known IPs.
