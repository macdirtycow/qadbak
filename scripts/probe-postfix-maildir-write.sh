#!/usr/bin/env bash
# Test whether the postfix user can write to a Maildir (AppArmor / permissions).
set -euo pipefail
MAILDIR="${1:?/path/to/Maildir}"
PROBE="$MAILDIR/new/.qadbak-write-probe-$$"

mkdir -p "$MAILDIR"/{cur,new,tmp}

if ! id postfix &>/dev/null; then
  echo "FAIL — postfix unix user not found"
  exit 1
fi

if sudo -u postfix touch "$PROBE" 2>/dev/null; then
  rm -f "$PROBE"
  echo "OK — postfix can write to $MAILDIR"
  exit 0
fi

echo "FAIL — postfix cannot write to $MAILDIR"
echo "      Common fix: sudo bash scripts/configure-postfix-apparmor.sh"
if command -v aa-status &>/dev/null; then
  echo "==> recent AppArmor DENIED (postfix)"
  grep -i 'postfix.*DENIED' /var/log/syslog 2>/dev/null | tail -5 || \
    journalctl -k --no-pager -n 20 2>/dev/null | grep -i denied | tail -5 || true
fi
exit 1
