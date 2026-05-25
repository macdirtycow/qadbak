#!/usr/bin/env bash
# Helper: emit panel/hosting vhost listen modifiers that respect the
# qadbak-default-deny vhost.
#
# WHY: scripts/apply-nginx-default-deny.sh writes a neutral vhost that
# claims default_server on ports 80/443 (HTTP 444 for unknown Host). If
# the panel/hosting vhost ALSO claims default_server on the same port,
# nginx fails the config test with [emerg] duplicate default server,
# the service goes down, and the entire VPS becomes unreachable.
#
# Solution: when default-deny is enabled, the panel vhost MUST omit
# default_server. When it is NOT enabled, the panel vhost should keep
# default_server (legacy behaviour for fresh installs).
#
# Public API (source this file from a panel-vhost emitter):
#   default_deny_enabled
#       returns 0 (true) iff /etc/nginx/sites-enabled/qadbak-default-deny.conf
#       exists (regular file or symlink). Override by exporting
#       QADBAK_DEFAULT_DENY_FILE for tests.
#
#   panel_default_server_keyword
#       echoes ' default_server' (with a leading space) when it is safe
#       for the panel vhost to claim default_server, else echoes nothing.
#       Use directly inside listen lines:
#           kw="$(panel_default_server_keyword)"
#           printf 'listen 80%s;\n'        "$kw"
#           printf 'listen [::]:80%s;\n'   "$kw"
#
# Self-test:
#   bash scripts/lib/nginx-listen.sh --self-test
#       prints the keyword + listen block for both branches so the
#       behaviour can be inspected without nginx installed.
set -euo pipefail

QADBAK_DEFAULT_DENY_FILE="${QADBAK_DEFAULT_DENY_FILE:-/etc/nginx/sites-enabled/qadbak-default-deny.conf}"

default_deny_enabled() {
  local f="${QADBAK_DEFAULT_DENY_FILE}"
  [[ -L "$f" ]] || [[ -f "$f" ]]
}

panel_default_server_keyword() {
  if default_deny_enabled; then
    printf ''
  else
    printf ' default_server'
  fi
}

# Self-test entry point: only triggers when this file is executed directly,
# not when it is sourced (the panel-vhost scripts always source it).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    --self-test|--test)
      echo "==> scripts/lib/nginx-listen.sh self-test"
      echo ""

      tmpdir="$(mktemp -d)"
      fake_deny="${tmpdir}/qadbak-default-deny.conf"
      : >"$fake_deny"
      QADBAK_DEFAULT_DENY_FILE="$fake_deny"
      kw_a="$(panel_default_server_keyword)"
      echo "Branch A — default-deny enabled (panel MUST NOT claim default_server)"
      echo "    QADBAK_DEFAULT_DENY_FILE=${fake_deny}"
      echo "    panel_default_server_keyword='${kw_a}'"
      echo "    listen 80${kw_a};"
      echo "    listen [::]:80${kw_a};"
      echo "    listen 443 ssl http2${kw_a};"
      echo "    listen [::]:443 ssl http2${kw_a};"
      rm -rf "$tmpdir"
      echo ""

      QADBAK_DEFAULT_DENY_FILE="/nonexistent/qadbak-default-deny.conf"
      kw_b="$(panel_default_server_keyword)"
      echo "Branch B — default-deny absent (panel claims default_server, fresh install)"
      echo "    QADBAK_DEFAULT_DENY_FILE=${QADBAK_DEFAULT_DENY_FILE}"
      echo "    panel_default_server_keyword='${kw_b}'"
      echo "    listen 80${kw_b};"
      echo "    listen [::]:80${kw_b};"
      echo "    listen 443 ssl http2${kw_b};"
      echo "    listen [::]:443 ssl http2${kw_b};"
      ;;
    -h|--help)
      sed -n '1,32p' "$0" | sed 's/^# \{0,1\}//'
      ;;
    *)
      echo "Library — source this file from a panel-vhost emitter." >&2
      echo "Run with --self-test to inspect both branches." >&2
      exit 0
      ;;
  esac
fi
