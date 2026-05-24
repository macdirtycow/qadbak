#!/usr/bin/env bash
# Test whether the mailbox unix user can write to Maildir (same uid as Postfix virtual delivery).
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
[[ -d "$ROOT" ]] || ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/mail-postfix-paths.sh
. "$ROOT/scripts/lib/mail-postfix-paths.sh"

MAILDIR="${1:?/path/to/Maildir}"
MAIL_USER="${2:-}"

MAILDIR="$(qadbak_absolute_maildir_from_vmbox "$MAILDIR")"

if [[ -z "$MAIL_USER" ]]; then
  MAIL_USER="$(qadbak_unix_user_from_maildir "$MAILDIR")"
fi
[[ -n "$MAIL_USER" ]] || MAIL_USER="postmaster"

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
