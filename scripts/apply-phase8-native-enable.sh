#!/usr/bin/env bash
# Enable all phase-8 native modules on test VPS.
set -euo pipefail
exec bash "$(dirname "$0")/apply-phase8-native-phase.sh" "ssl,dns,mail,db,domain,backup,cron,aliases,redirects,features,logs"
