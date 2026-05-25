# Publishing a Premium bundle

End-to-end workflow for turning a Premium source folder into a downloadable
artifact that customer Qadbak panels can fetch via **Server admin → License →
Refresh modules**.

```
your Premium source ──build──► signed tarball ──publish──► GitHub Release
                                                                │
                                                                ▼
  customer panel ──/v1/artifacts/<version>/premium.tar.gz?token=──► license server
                                                                │
                                                                ▼
                                                       GitHub asset stream
```

## One-time setup

### 1. Generate a signing keypair

The panel verifies signatures with `config/license-public.pem`. You sign with
the matching private key.

```bash
npm run premium:keygen -- ~/keys
```

Outputs:
- `~/keys/qadbak-license-ed25519.pem` — **keep secret, vault it**
- `~/keys/qadbak-license-ed25519.pub.pem` — copy to `config/license-public.pem` in the public qadbak repo and commit it

### 2. Create a private GitHub repo for releases

```bash
gh repo create macdirtycow/qadbak-premium-artifacts --private --confirm
```

The license server only needs **read** access to releases on this repo. The
publish script needs **write** access (you, locally).

### 3. Configure your shell

Add to `~/.zshrc` (or wherever):

```bash
export QADBAK_PREMIUM_SRC="$HOME/code/qadbak-premium/dist"
export QADBAK_LICENSE_SIGNING_KEY="$HOME/keys/qadbak-license-ed25519.pem"
export QADBAK_PREMIUM_REPO="macdirtycow/qadbak-premium-artifacts"
```

`QADBAK_PREMIUM_SRC` should point at a folder that mirrors the layout of
`premium.manifest.json`. The build script warns at build time if a file
declared in the manifest is missing.

## Ship a release

Tag a version (in either `QADBAK_PREMIUM_VERSION`, or `package.json#version`
inside the source folder, or a `version.txt`), then:

```bash
npm run premium:ship
```

That runs `premium:build` then `premium:publish`. The build script:
- Tars `$QADBAK_PREMIUM_SRC` into `dist/premium/premium-<version>.tar.gz`
- Signs the SHA-256 digest with your Ed25519 private key
- Writes `dist/premium/premium-<version>.tar.gz.sig` next to it

The publish script:
- Looks for `v<version>` on `$QADBAK_PREMIUM_REPO`
- Creates the release if missing, or replaces assets if present (`--clobber`)
- Uploads both the tarball and the `.sig` as release assets

Want to verify the bundle yourself before shipping?

```bash
QADBAK_PREMIUM_VERIFY_PUBKEY=~/keys/qadbak-license-ed25519.pub.pem \
  npm run premium:build
```

## License-server side

For customer panels to actually fetch the tarball, the license server
(`license.omiiba.dev`) must expose `GET /v1/artifacts/:version/:file`.

Drop-in handler: `scripts/premium/license-server-handler.mjs`. Three adapters
included:

- **Express**:
  ```js
  import express from "express";
  import { registerExpress } from "./license-server-handler.mjs";
  const app = express();
  registerExpress(app);
  app.listen(8787);
  ```
- **Next.js App Router** — drop into
  `app/api/v1/artifacts/[version]/[file]/route.js`:
  ```js
  import { createNextRouteHandler } from "../../../../../scripts/premium/license-server-handler.mjs";
  export const GET = createNextRouteHandler();
  ```
- **Bare `http.Server`** — `createNodeHandler()` returns a `(req, res) => …`
  function.

Required env on the license server:

| Var | What |
|-----|------|
| `QADBAK_LICENSE_JWT_SECRET` | Same secret used to sign customer JWTs at `/v1/activate` |
| `QADBAK_PREMIUM_REPO` | `macdirtycow/qadbak-premium-artifacts` |
| `GITHUB_TOKEN` | PAT with `repo` scope (read) on that repo |

The handler validates the customer's JWT, then streams the asset directly
from the GitHub API to the panel. Nothing cached on disk — GH's CDN handles
that.

## Common errors

| Customer sees… | Cause | Fix |
|----------------|-------|-----|
| `License server has no Premium build for version X (HTTP 404)` | You haven't published `vX` yet | `QADBAK_PREMIUM_VERSION=X npm run premium:ship` |
| `License server rejected the token (HTTP 403)` | Token's `artifactVersion` doesn't match the requested version | The customer needs to run **Heartbeat now** to refresh their token's `artifactVersion` |
| `Premium artifact signature verification failed` | Tarball was rebuilt without re-signing, or panel has wrong `config/license-public.pem` | Re-publish, or update the panel's `config/license-public.pem` |

## Bumping versions

When you ship `0.2.0`:

1. Tag your Premium source as `0.2.0` (either `package.json#version` or `version.txt`).
2. `npm run premium:ship`.
3. Update the license server so newly-activated keys get `artifactVersion: "0.2.0"` in the token (existing customers will pull the new version after their next **Heartbeat now**).

The panel side requires no change: it always asks for the version embedded in
its current token.
