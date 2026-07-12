#!/usr/bin/env bash
# Emit per-command sudoers lines (no broad NOPASSWD: WRAPPER *).
# Usage: generate-sudoers-allowlist.sh USER WRAPPER ALLOWLIST_FILE [HEADER] [--wildcard-all]
#
# Allowlist format — one subcommand per line:
#   ping              → exact match (no extra args)
#   domain-create *   → allow trailing args (JSON payloads, paths, …)
# With --wildcard-all every line from ALLOWLIST gets a trailing * in sudoers.
set -euo pipefail

USER="${1:?user}"
WRAPPER="${2:?wrapper}"
ALLOWLIST="${3:?allowlist}"
HEADER="${4:-# Qadbak sudo allowlist (generated — do not edit)}"
WILDCARD_ALL="${5:-}"

echo "$HEADER"
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  if [[ "$WILDCARD_ALL" == "--wildcard-all" ]]; then
    printf '%s ALL=(root) NOPASSWD: %s %s *\n' "$USER" "$WRAPPER" "$line"
  elif [[ "$line" == *' *' ]]; then
    cmd="${line% \*}"
    printf '%s ALL=(root) NOPASSWD: %s %s *\n' "$USER" "$WRAPPER" "$cmd"
  else
    printf '%s ALL=(root) NOPASSWD: %s %s\n' "$USER" "$WRAPPER" "$line"
  fi
done <"$ALLOWLIST"
