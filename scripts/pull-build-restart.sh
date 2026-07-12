#!/usr/bin/env bash
# Fast VPS deploy — delegates to scripts/update.sh (git pull, sudoers, build, restart).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/update.sh"
