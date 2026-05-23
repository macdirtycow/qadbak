#!/usr/bin/env bash
# Test local inbound delivery (Postfix → Maildir). Does not use external MX.
# Usage: sudo bash scripts/test-mail-receive.sh DOMAIN MAILBOX_USER
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:?domain}"
USER_LOCAL="${2:?mailbox user e.g. info}"

echo "==> mail-receive-test $DOMAIN $USER_LOCAL"
OUT="$(sudo -u "${QADBAK_USER:-qadbak}" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" \
  mail-receive-test "$DOMAIN" "$USER_LOCAL" 2>&1 | tail -1)"
echo "$OUT" | python3 -m json.tool 2>/dev/null || echo "$OUT"

if echo "$OUT" | grep -q '"ok":true'; then
  echo "OK — message queued to Maildir (check IMAP tab → INBOX)"
else
  echo "FAIL" >&2
  exit 1
fi
