#!/usr/bin/env bash
# Enable all v1 panel native modules (independent mode, no VirtualMin API).
set -euo pipefail
exec bash "$(dirname "$0")/apply-phase8-native-phase.sh" \
  "ssl,dns,mail,db,backup,cron,aliases,redirects,features,logs"
