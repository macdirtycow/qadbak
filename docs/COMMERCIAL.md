# Qadbak commercial tiers

Copyright (c) 2026 MacDirtyCow / Qadbak and Omiiba. See [LICENSE](../LICENSE).

## Tiers

| Tier | What you install |
|------|------------------|
| **Core** | Public [`macdirtycow/qadbak`](https://github.com/macdirtycow/qadbak) — evaluation on your own VPS |
| **Premium** | Activated in **Server admin → License**; modules download from the license server |

Public `git clone` gives Core only. Premium features need a valid license and **Refresh modules** in the panel.

## Licensed panel configuration

In `/opt/qadbak/.env.local`:

```env
QADBAK_LICENSE_SERVER=https://license.omiiba.dev
QADBAK_GIT_BRANCH=main
```

Plus the panel ships with `config/license-public.pem` (Ed25519 public
key) bundled in the public git repo — no extra config needed for
verification. See [License verification](#license-verification) below
for the security model.

Then **Activate** your key and **Refresh modules**.

## License verification

Qadbak verifies the JWT issued by the license server using **Ed25519
asymmetric signatures**. The flow:

1. License server signs each token with its private Ed25519 key
   (kept in a vault on the operator side).
2. Customer panels carry the matching public key at
   `config/license-public.pem` — bundled in the public git repo, safe
   to distribute.
3. The panel verifies tokens locally using that public key, without
   ever needing the license server's secret.

If `config/license-public.pem` is missing or unreadable, the panel falls
back to symmetric **HS256** verification — but only if you explicitly
set `QADBAK_LICENSE_JWT_SECRET` to match the license server's HS256
secret. Without either path configured, license tokens are rejected and
Premium stays locked. The License page surfaces the exact verification
error on the License tab.

### Operator side (license server)

Use `scripts/premium/license-server-jwt.mjs` as a drop-in JWT signer:

```js
import { signLicenseToken } from "./license-server-jwt.mjs";

const token = await signLicenseToken({
  plan: "pro",
  features: ["admin-updates", "client-rbac", /* … */],
  instanceId,
  artifactVersion: "0.1.0",
  expiresAt: "2027-01-01T00:00:00Z",
});
```

Required env on the license server:

| Var | What |
|-----|------|
| `QADBAK_LICENSE_SIGNING_KEY` | Ed25519 private key PEM (vault it) |
| `QADBAK_LICENSE_HS256_SECRET` | Optional legacy HS256 secret for panels still on the old code path |

Generate the keypair once: `npm run premium:keygen -- ~/keys`. Copy the
public PEM into `config/license-public.pem` in the public qadbak repo
and ship that file in every customer panel update.

### Existing install — bought Premium later?

If you already have Qadbak Core running and just bought a key, the
one-liner below does pull + rebuild + activate + sync + reload in a
single safe pass:

```bash
sudo bash /opt/qadbak/scripts/buy-premium.sh QAD-XXXX-YYYY-ZZZZ-WWWW
```

Idempotent — safe to re-run if any step fails.

Daily heartbeat (optional):

```bash
0 4 * * * /opt/qadbak/scripts/license-heartbeat.sh >> /opt/qadbak/data/license-heartbeat.log 2>&1
```

## Updates

```bash
cd /opt/qadbak && sudo bash scripts/update-qadbak.sh
node scripts/qadbak-license-cli.mjs sync
```

`update-qadbak.sh` runs `scripts/git-sync-origin.sh`, which fetches origin and aligns the checkout with `QADBAK_GIT_BRANCH` (default **`main`** for production).

**One-time bootstrap** if an older install still tracks the internal branch:

```bash
sudo bash /opt/qadbak/scripts/switch-vps-to-main.sh
sudo bash /opt/qadbak/scripts/update-qadbak.sh
```

Premium **source** and license-server **operator** tooling live in the private repo [`macdirtycow/qadbak-premium`](https://github.com/macdirtycow/qadbak-premium) — not in public qadbak.

## What eval users may not do

- Host paying customers without a commercial license
- Redistribute Premium bundles or remove license checks

See [COMMERCIAL-LICENSING.md](../COMMERCIAL-LICENSING.md).
