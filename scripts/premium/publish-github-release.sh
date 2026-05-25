#!/usr/bin/env bash
# Publish a Premium bundle to a GitHub Release on a (private) repo.
#
# The license server reads from this repo to proxy artifacts to
# customer panels (see scripts/premium/license-server-handler.mjs).
#
# Required env:
#   QADBAK_PREMIUM_REPO    e.g. macdirtycow/qadbak-premium-artifacts
#                          (private repo where releases live)
#
# Optional env:
#   QADBAK_PREMIUM_VERSION (default: parsed from latest tarball name)
#   QADBAK_PREMIUM_OUT     (default: dist/premium)
#   QADBAK_PREMIUM_PRERELEASE  if "true", marks the release as prerelease
#   QADBAK_PREMIUM_NOTES_FILE  path to release notes (markdown) — optional
#
# Auth: this script uses the `gh` CLI. Make sure `gh auth status` works
# and the authenticated account has write access to the target repo.
#
# Usage:
#   QADBAK_PREMIUM_REPO=macdirtycow/qadbak-premium-artifacts \
#     bash scripts/premium/publish-github-release.sh
#
# Idempotency:
#  - If a release for v<version> already exists, the script REPLACES the
#    two assets (tarball + sig) rather than failing or creating a new
#    duplicate release. The tag itself is reused.

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not installed. https://cli.github.com/" >&2
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: not authenticated to GitHub. Run: gh auth login" >&2
  exit 2
fi

if [[ -z "${QADBAK_PREMIUM_REPO:-}" ]]; then
  echo "error: QADBAK_PREMIUM_REPO is required (e.g. macdirtycow/qadbak-premium-artifacts)" >&2
  exit 2
fi
REPO="${QADBAK_PREMIUM_REPO}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${QADBAK_PREMIUM_OUT:-$ROOT/dist/premium}"

if [[ ! -d "$OUT_DIR" ]]; then
  echo "error: $OUT_DIR does not exist. Run \`node scripts/premium/build-bundle.mjs\` first." >&2
  exit 2
fi

# Resolve version: explicit, or by inspecting the newest tarball in OUT_DIR
if [[ -n "${QADBAK_PREMIUM_VERSION:-}" ]]; then
  VERSION="$QADBAK_PREMIUM_VERSION"
else
  LATEST_TAR=$(find "$OUT_DIR" -maxdepth 1 -name 'premium-*.tar.gz' -print 2>/dev/null \
    | sort -r | head -n1)
  if [[ -z "$LATEST_TAR" ]]; then
    echo "error: no premium-*.tar.gz in $OUT_DIR. Build first." >&2
    exit 2
  fi
  VERSION=$(basename "$LATEST_TAR" | sed -E 's/^premium-(.+)\.tar\.gz$/\1/')
fi

TAG="v${VERSION}"
TARBALL="$OUT_DIR/premium-${VERSION}.tar.gz"
SIG="$TARBALL.sig"

if [[ ! -f "$TARBALL" ]]; then
  echo "error: tarball not found: $TARBALL" >&2
  exit 2
fi
if [[ ! -f "$SIG" ]]; then
  echo "error: signature not found: $SIG (run build-bundle.mjs)" >&2
  exit 2
fi

PRERELEASE_FLAG=""
if [[ "${QADBAK_PREMIUM_PRERELEASE:-false}" == "true" ]]; then
  PRERELEASE_FLAG="--prerelease"
fi

NOTES_ARGS=()
if [[ -n "${QADBAK_PREMIUM_NOTES_FILE:-}" && -f "${QADBAK_PREMIUM_NOTES_FILE}" ]]; then
  NOTES_ARGS+=(--notes-file "${QADBAK_PREMIUM_NOTES_FILE}")
else
  NOTES_ARGS+=(--notes "Qadbak Premium bundle ${TAG}.")
fi

echo "Repo:    $REPO"
echo "Tag:     $TAG"
echo "Tarball: $TARBALL ($(du -h "$TARBALL" | cut -f1))"
echo "Sig:     $SIG"
echo

# Does a release for this tag already exist?
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release $TAG already exists on $REPO — replacing assets."
  gh release upload "$TAG" "$TARBALL" "$SIG" \
    --repo "$REPO" --clobber
else
  echo "Creating release $TAG on $REPO."
  # shellcheck disable=SC2068
  gh release create "$TAG" "$TARBALL" "$SIG" \
    --repo "$REPO" \
    --title "Premium $TAG" \
    ${PRERELEASE_FLAG} \
    ${NOTES_ARGS[@]+"${NOTES_ARGS[@]}"}
fi

echo
echo "Published successfully:"
echo "  https://github.com/$REPO/releases/tag/$TAG"
echo
echo "License-server proxy must now resolve $TAG and fetch the assets."
echo "See scripts/premium/license-server-handler.mjs for the drop-in handler."
