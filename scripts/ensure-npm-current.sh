#!/usr/bin/env bash
# Upgrade npm on the panel VPS when it lags behind (NodeSource ships older npm).
set -euo pipefail

QADBAK_USER="${QADBAK_USER:-qadbak}"
MIN_NPM_MAJOR="${QADBAK_NPM_MIN_MAJOR:-11}"
TARGET_NPM="${QADBAK_NPM_TARGET:-^11}"

resolve_npm() {
  local node_bin npm_bin
  node_bin="$(sudo -u "$QADBAK_USER" -H bash -lc 'command -v node' 2>/dev/null | head -1 || true)"
  [[ -z "$node_bin" ]] && node_bin="$(command -v node 2>/dev/null || true)"
  [[ -z "$node_bin" ]] && return 1
  npm_bin="$(dirname "$node_bin")/npm"
  [[ -x "$npm_bin" ]] || npm_bin="$(command -v npm 2>/dev/null || true)"
  [[ -x "$npm_bin" ]] || return 1
  echo "$npm_bin"
}

NPM_BIN="$(resolve_npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo "WARN — npm not found; skip npm upgrade" >&2
  exit 0
fi

CURRENT="$("$NPM_BIN" -v 2>/dev/null || echo 0)"
CURRENT_MAJOR="${CURRENT%%.*}"

if [[ "$CURRENT_MAJOR" -ge "$MIN_NPM_MAJOR" ]]; then
  echo "OK — npm $CURRENT"
  exit 0
fi

echo "==> Upgrading npm $CURRENT → $TARGET_NPM"
if [[ "$(id -u)" -eq 0 ]]; then
  "$NPM_BIN" install -g "npm@${TARGET_NPM}" || npm install -g "npm@${TARGET_NPM}"
else
  "$NPM_BIN" install -g "npm@${TARGET_NPM}"
fi

echo "OK — npm $("$NPM_BIN" -v)"
