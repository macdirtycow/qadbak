#!/usr/bin/env bash
# Test whether the mailbox unix user can write to Maildir (same uid as Postfix virtual delivery).
set -euo pipefail
MAILDIR="${1:?/path/to/Maildir}"
MAIL_USER="${2:-}"

# qadbak-vmailbox stores paths relative to virtual_mailbox_base=/.
if [[ "$MAILDIR" != /* ]]; then
  MAILDIR="/${MAILDIR#/}"
fi
MAILDIR="${MAILDIR%/}"

if [[ -z "$MAIL_USER" ]]; then
  # Parent of Maildir is the mailbox unix user (info) or domain owner (siccamanagement).
  MAIL_USER="$(basename "$(dirname "$MAILDIR")")"
fi
[[ -n "$MAIL_USER" ]] || MAIL_USER="info"

PROBE="$MAILDIR/new/.qadbak-write-probe-$$"
mkdir -p "$MAILDIR"/{cur,new,tmp}

if ! id "$MAIL_USER" &>/dev/null; then
  echo "FAIL — unix user $MAIL_USER not found"
  exit 1
fi

if sudo -u "$MAIL_USER" touch "$PROBE" 2>/dev/null; then
  rm -f "$PROBE"
  echo "OK — user $MAIL_USER can write to $MAILDIR"
  exit 0
fi

echo "FAIL — user $MAIL_USER cannot write to $MAILDIR — check chown/chmod"
ls -ld "$MAILDIR" "$(dirname "$MAILDIR")" 2>/dev/null || true
exit 1
