#!/usr/bin/env bash
# Start license server with /etc/qadbak/license-server.env (used by pm2).
set -euo pipefail
LICENSE_HOME="${QADBAK_LICENSE_HOME:-/opt/qadbak-license-server}"
ENV_FILE="${QADBAK_LICENSE_ENV:-/etc/qadbak/license-server.env}"
cd "$LICENSE_HOME"
[[ -f "$ENV_FILE" ]] || {
  echo "Missing $ENV_FILE — run setup-local-license-server.sh first." >&2
  exit 1
}
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
exec "$(command -v node)" src/server.mjs
