#!/usr/bin/env bash
# Shared shell-level subcommand gate for sudo wrappers.
# Usage: write-wrapper-allowlist.sh WRAPPER_PATH ALLOWLIST_PATH NODE_BIN HELPER_PATH
set -euo pipefail

WRAPPER="${1:?wrapper path}"
ALLOWLIST="${2:?allowlist path}"
NODE_BIN="${3:?node binary}"
HELPER="${4:?helper script}"

SHELL_ALLOWLIST="${ALLOWLIST/-commands.txt/-shell-commands.txt}"
: >"$SHELL_ALLOWLIST"
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  echo "${line% \*}" >>"$SHELL_ALLOWLIST"
done <"$ALLOWLIST"

cat >"$WRAPPER" <<'WRAPPER_HEAD'
#!/bin/bash
# NOPASSWD sudo wrapper — subcommand allowlist enforced here and in sudoers.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_HEAD

printf 'QADBAK_NODE_BIN="%s"\n' "$NODE_BIN" >>"$WRAPPER"
printf 'HELPER="%s"\n' "$HELPER" >>"$WRAPPER"
printf 'ALLOWLIST="%s"\n' "$SHELL_ALLOWLIST" >>"$WRAPPER"

cat >>"$WRAPPER" <<'WRAPPER_TAIL'
CMD="${1:-}"
if [[ -z "$CMD" ]] || ! grep -qxF "$CMD" "$ALLOWLIST" 2>/dev/null; then
  echo "Disallowed command: ${CMD:-(empty)}" >&2
  exit 1
fi
exec "$QADBAK_NODE_BIN" "$HELPER" "$@"
WRAPPER_TAIL

chmod 755 "$WRAPPER" "$SHELL_ALLOWLIST"
