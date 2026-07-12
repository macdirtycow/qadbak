#!/usr/bin/env bash
# Back-compat wrapper - use install/qadbak-install.sh
exec bash "$(dirname "$0")/qadbak-install.sh" "$@"
