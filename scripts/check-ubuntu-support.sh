#!/usr/bin/env bash
# Backward-compatible entry — delegates to check-linux-support.sh
set -euo pipefail
exec bash "$(dirname "$0")/check-linux-support.sh" "$@"
