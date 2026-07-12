#!/usr/bin/env bash
# Fail if any qadbak sudoers file still uses a bare "WRAPPER *" / "SCRIPT *" (one unbounded arg).
set -euo pipefail

BAD=0
for f in /etc/sudoers.d/qadbak-*; do
  [[ -f "$f" ]] || continue
  while IFS= read -r line; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "${line// /}" ]] && continue
    # Allow: exact paths, per-command args, or two-arg backup rules ending in "* *"
    if [[ "$line" =~ NOPASSWD:[[:space:]]+[^[:space:]]+[[:space:]]+\*[[:space:]]*$ ]]; then
      echo "BROAD SUDOERS: $f" >&2
      echo "  $line" >&2
      BAD=1
    fi
  done <"$f"
done

if [[ "$BAD" -ne 0 ]]; then
  echo "Re-run configure-*-sudo.sh scripts from /opt/qadbak after git pull." >&2
  exit 1
fi
echo "OK — no bare NOPASSWD: <script> * rules in qadbak sudoers"
