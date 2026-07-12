# Agent listen modes

The agent serves HTTPS on port **9443** by default. **It does not bind to `0.0.0.0` unless you explicitly choose LAN mode during onboarding.**

## Defaults

| Context | Listen address |
|---------|----------------|
| Manual `qadbak-agent` start (no env) | `127.0.0.1:9443` |
| Installer `auto` mode + Tailscale present | `{tailscale-ip}:9443` |
| Installer `auto` mode, no Tailscale | `127.0.0.1:9443` |
| iOS onboarding (user choice) | See modes below |

Environment overrides:

- `QADBAK_AGENT_LISTEN` — full address, e.g. `100.64.0.2:9443`
- `QADBAK_AGENT_LISTEN_MODE` — `tailscale`, `lan`, `local`, or `auto`

Config file: `/etc/qadbak-agent/agent.env` (written by installer)

## Modes

### Tailscale (recommended)

- Binds to the server's Tailscale IPv4 address only.
- If `ufw` is active, adds: allow in on `tailscale0` to port 9443.
- iOS pairs using the Tailscale IP returned by the install script.

### Private LAN

- Binds `0.0.0.0:9443` — **explicit opt-in** in iOS onboarding.
- Optional `ufw allow 9443/tcp` (review and restrict source IPs manually).
- Use only on trusted networks; prefer Tailscale when possible.

### Local only

- Binds `127.0.0.1:9443`.
- Phone access requires VPN, Tailscale subnet router, or SSH port forwarding.
- Advanced / recovery scenarios.

## iOS onboarding

During **Install consent**, the app asks how your phone should reach the agent. Tailscale is pre-selected when detected over SSH; otherwise LAN is offered with a warning.

The install script prints `agent_listen_host:…` so pairing uses the correct address (not necessarily the SSH host).

## Pairing during install

The installer calls `POST /api/v1/pairing/init` on the resolved bind address (loopback substitute when bind is `0.0.0.0`).

## Hardening checklist

1. Prefer **Tailscale** over public LAN exposure.
2. Keep **TLS pin** from first pairing — do not skip fingerprint confirmation.
3. Use **`ufw`** or cloud security groups to limit 9443 to known sources if you must use LAN mode.
4. Revoke tokens from the app or delete `/var/lib/qadbak-agent/tokens.json` if a device is lost.

See also [SECURITY.md](./SECURITY.md) and [BINARY_SUPPLY_CHAIN.md](./BINARY_SUPPLY_CHAIN.md).
