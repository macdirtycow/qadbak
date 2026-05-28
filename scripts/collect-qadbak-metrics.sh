#!/usr/bin/env bash
# Append host metrics snapshot (phase 6). Install via cron every 15 minutes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node scripts/provisioning-helper.mjs metrics-snapshot >/dev/null
