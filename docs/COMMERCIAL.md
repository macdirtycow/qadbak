# Qadbak commercial tiers

Copyright 2026 MacDirtyCow / Qadbak and Inveil. The panel is licensed for
**panel use only** — see [LICENSE](../LICENSE). Premium modules require a
paid key (below).

## Tiers

| Tier | What you install |
|------|------------------|
| **Panel** | Official [`macdirtycow/qadbak`](https://github.com/macdirtycow/qadbak) — install on **your** VPS to manage hosting (not redistributable) |
| **Premium** | Paid runtime add-on, activated in **Server admin → License** |

The repository is public so customers can install and update easily. That
does **not** grant permission to redistribute, mirror, or resell the
software as a competing product. See [LICENSE](../LICENSE) and
[qadbak.com/terms](https://qadbak.com/terms).

## Licensed panel configuration

In `/opt/qadbak/.env.local`:

```env
QADBAK_LICENSE_SERVER=https://license.inveil.dev
QADBAK_GIT_BRANCH=main
```

That's the entire required config. **Activate** your key under
*Server admin → License* and you're done. See
[License verification](#license-verification) below for what's happening
under the hood and how to opt into cryptographic verification if you
want defense-in-depth.

### Existing install — bought Premium later?

If you already have Qadbak running and just bought a key, the
one-liner below does pull + rebuild + activate in a single safe pass:

```bash
sudo bash /opt/qadbak/scripts/buy-premium.sh QAD-XXXX-YYYY-ZZZZ-WWWW
```

Idempotent — safe to re-run if any step fails.

### Moving to a new VPS

On the **old** server: *Server admin → License* → **Other servers using this
license** → **Remove** the stale row (or **Deactivate** if the old box still
runs). On the **new** server: paste the same key and **Activate**. If the old
VPS is unreachable, email [info@inveil.net](mailto:info@inveil.net) with your
key to release the slot.

## Updates

```bash
cd /opt/qadbak && sudo bash scripts/update-qadbak.sh
```

Identical flow for all installs: `git pull`, `npm run
build`, `pm2 restart`. The updater runs an opportunistic license
heartbeat at the end so revocations propagate immediately instead of
waiting for the next scheduled tick.

`update-qadbak.sh` runs `scripts/git-sync-origin.sh`, which fetches
origin and aligns the checkout with `QADBAK_GIT_BRANCH` (default
**`main`** for production).

**One-time bootstrap** if an older install still tracks a non-main branch:

```bash
sudo bash /opt/qadbak/scripts/switch-vps-to-main.sh
sudo bash /opt/qadbak/scripts/update-qadbak.sh
```

## License verification

Qadbak uses a **heartbeat-based trust model** by default — the same
pattern Stripe, Auth0, Keygen, and most SaaS-licensing services use.
The license server (not the panel) is the source of truth.

How it works:

1. **Activate.** The panel exchanges your key for a JWT with the license
   server and writes it to `data/license.json`. The activate request
   already *is* a heartbeat — if it succeeds, the cache is fresh.
2. **Background heartbeats.** An in-process scheduler hits
   `POST /v1/heartbeat` every **6 hours** (configurable via
   `QADBAK_HEARTBEAT_INTERVAL_HOURS`). If the license server reports
   `revoked`, the local file is cleared on the spot.
3. **Freshness gate.** `isPremiumActive()` requires the most recent
   heartbeat to be within the **48-hour grace window**
   (`QADBAK_HEARTBEAT_GRACE_HOURS`). That's ~8 missed heartbeats of
   slack — enough to ride out a long outage, short enough that a
   tampered cache only buys at most 48h of fake Premium.
4. **Revocation propagation.** Worst-case time-to-revoke is the grace
   window. Click **Heartbeat now** on the License page to force it
   immediately.

This is "zero operator setup" by design. No key generation, no secrets
in your env, no per-customer crypto config. The trade-off is that an
attacker with write access to `data/license.json` AND the ability to
block the panel's outbound HTTPS to the license server could buy
themselves up to 48h of fake Premium before the next successful
heartbeat invalidates it. For most customers that's fine.

### Opt-in: cryptographic verification (defense-in-depth)

If you (operator) want hard cryptographic verification on top of
heartbeats, ship a bundled public key. The panel will then require
every license token to verify against it — failed crypto = Premium
locked, even with a fresh heartbeat.

1. **Generate a keypair** (one time, on a trusted machine) — any
   Ed25519 keypair works; `openssl genpkey -algorithm Ed25519` is the
   one-liner most ops teams already have.
2. **Configure the license server** to sign tokens with the private
   key. Use `scripts/premium/license-server-jwt.mjs` as a drop-in:
   ```js
   import { signLicenseToken } from "./license-server-jwt.mjs";
   const token = await signLicenseToken({
     plan: "pro",
     features: ["admin-updates", "client-rbac"],
     instanceId,
     expiresAt: "2027-01-01T00:00:00Z",
   });
   ```
   Required env: `QADBAK_LICENSE_SIGNING_KEY` (the private PEM).
3. **Ship the public key** to customer panels: copy the `.pub.pem` to
   `config/license-public.pem` in the public qadbak repo, commit, and
   push. Every panel that updates picks it up automatically.

For transitional setups, the panel also accepts symmetric **HS256**
verification if `QADBAK_LICENSE_JWT_SECRET` is set to match the
license server's HS256 secret — only useful when panel and license
server share a secret store, e.g. local dev.

The License page surfaces which trust path is in effect under
**Trust mode** so you can verify your config is actually active.

### Tuning

| Env var | Default | What |
|---------|---------|------|
| `QADBAK_HEARTBEAT_INTERVAL_HOURS` | `6` | How often the scheduler hits `/v1/heartbeat` |
| `QADBAK_HEARTBEAT_GRACE_HOURS` | `48` | How long a stale heartbeat is still trusted before downgrading |
| `QADBAK_DISABLE_HEARTBEAT_SCHEDULER` | unset | Set `true` to disable the in-process scheduler (e.g. for tests) |
| `QADBAK_DEBUG_HEARTBEAT` | unset | Set `true` to log each successful heartbeat |
| `QADBAK_PREMIUM_FEATURES` | unset | Dev/CI only — comma-separated override; ignored in production |

## Redistribution and forks

You may **not** redistribute, mirror, or offer the Qadbak panel (source or
binary) as a competing product without written permission. Installing from
the official repository on servers you control is permitted.

Removing license checks or bypassing Premium gates in production violates
[LICENSE](../LICENSE) and may result in license revocation.

See [COMMERCIAL-LICENSING.md](../COMMERCIAL-LICENSING.md).
