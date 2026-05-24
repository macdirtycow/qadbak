#!/usr/bin/env bash
# Allow Postfix to deliver into Qadbak Maildirs under /home/*/homes/*/Maildir/
# (default Ubuntu AppArmor only allows /home/*/Maildir/, not nested homes/).
set -euo pipefail

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

LOCAL="/etc/apparmor.d/local/usr.sbin.postfix"
MARKER="# qadbak-homes-maildir"

if [[ -f "$LOCAL" ]] && grep -q "$MARKER" "$LOCAL" 2>/dev/null; then
  echo "OK — AppArmor postfix homes/Maildir rules already present"
else
  cat >>"$LOCAL" <<EOF

$MARKER
/home/*/homes/*/Maildir/ r,
/home/*/homes/*/Maildir/** rw,
/home/*/homes/** r,
EOF
  echo "==> Added Postfix AppArmor rules for /home/*/homes/*/Maildir/"
fi

if command -v apparmor_parser &>/dev/null && [[ -f /etc/apparmor.d/usr.sbin.postfix ]]; then
  apparmor_parser -r /etc/apparmor.d/usr.sbin.postfix 2>/dev/null || true
fi
if command -v aa-enforce &>/dev/null; then
  aa-enforce usr.sbin.postfix 2>/dev/null || true
fi

echo "OK — reload AppArmor profile usr.sbin.postfix"
