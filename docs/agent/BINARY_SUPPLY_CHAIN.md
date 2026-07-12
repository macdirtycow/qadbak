# Agent binary supply chain

The iOS app ships Linux agent binaries as **app bundle resources**. They are uploaded to **your own server over SSH** during onboarding; iOS never executes them locally.

## What is bundled

| File | Purpose |
|------|---------|
| `qadbak-agent-linux-amd64` | Agent for x86_64 servers |
| `qadbak-agent-linux-arm64` | Agent for arm64 servers |
| `manifest.json` | Version + SHA-256 checksums per architecture |

Location: `ios/Qadbak/Resources/Agent/`

## Build and copy workflow

Always rebuild from source before committing bundled binaries:

```bash
bash scripts/copy-agent-to-ios.sh
```

This runs `agent/scripts/build-release.sh` (Go `-trimpath -buildvcs=false`, stripped binaries) and copies `dist/*` into the iOS bundle.

Verify without copying:

```bash
bash scripts/verify-agent-bundle.sh
```

CI runs this check on every agent workflow so stale or tampered bundles fail the build.

## Checksum guarantees

1. **Build time** — `build-release.sh` writes SHA-256 into `dist/manifest.json` and `SHA256SUMS`.
2. **iOS install time** — `AgentInstallService.verifiedBinary()` hashes the bundled file and refuses upload on mismatch.
3. **Server install time** — `packaging/install.sh` optionally verifies against a manifest path.
4. **CI** — `scripts/verify-agent-bundle.sh` rebuilds from source and compares hashes to the iOS bundle.

## Reproducibility notes

Go binaries may still differ across Go toolchain versions or `-ldflags` changes. We pin:

- `CGO_ENABLED=0`
- `-trimpath -buildvcs=false`
- `-ldflags="-s -w"`

Record the Go version from CI when auditing a release. Cosign/minisign signatures are planned (see `docs/agent/BETA.md`).

## App Store considerations

- Binaries are **Linux ELF executables**, not iOS code.
- They are transferred to a server the user controls via SSH (same pattern as Termius/Servers Mania install scripts).
- Document this in App Review notes: *"Optional SSH step installs an open-source monitoring agent on the user's Linux VPS; binaries are not executed on the device."*

## Do not

- Commit agent binaries without updating `manifest.json` in the same commit.
- Hand-edit checksums in `manifest.json`.
- Skip `verify-agent-bundle.sh` before release.
