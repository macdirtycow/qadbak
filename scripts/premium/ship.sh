#!/usr/bin/env bash
# Build, sign, and publish a Premium bundle in one go.
#
# Required env (same as the underlying scripts):
#   QADBAK_PREMIUM_SRC          path to the Premium source folder
#   QADBAK_LICENSE_SIGNING_KEY  PEM private Ed25519 key
#   QADBAK_PREMIUM_REPO         GitHub repo to publish releases to
#
# Optional:
#   QADBAK_PREMIUM_VERSION      e.g. 0.1.0 (auto-detected otherwise)
#   QADBAK_PREMIUM_VERIFY_PUBKEY  self-verify the signature after building
#   QADBAK_PREMIUM_PRERELEASE=true   mark the release as a prerelease

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

node "$ROOT/scripts/premium/build-bundle.mjs"
bash "$ROOT/scripts/premium/publish-github-release.sh"

echo
echo "Done. Customer panels can now click Refresh modules and pull this version."
