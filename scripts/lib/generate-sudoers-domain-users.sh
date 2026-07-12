#!/usr/bin/env bash
# Per-unix-user sudoers lines: SCRIPT user1, SCRIPT user2, …
# Usage: generate-sudoers-domain-users.sh USER SCRIPT HEADER
set -euo pipefail
USER="${1:?user}"
SCRIPT="${2:?script path}"
HEADER="${3:-# Qadbak per-user sudo (generated)}"
LIB_DIR="$(cd "$(dirname "$0")" && pwd)"
LIST="$LIB_DIR/list-sudo-unix-users.sh"

echo "$HEADER"
printf '%s ALL=(root) NOPASSWD: %s __probe__\n' "$USER" "$SCRIPT"
while IFS= read -r unix_user; do
  [[ -n "$unix_user" ]] || continue
  printf '%s ALL=(root) NOPASSWD: %s %s\n' "$USER" "$SCRIPT" "$unix_user"
done < <(bash "$LIST")
