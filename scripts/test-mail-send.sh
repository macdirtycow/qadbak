#!/usr/bin/env bash
# Send a test message via native mail-send helper.
# Usage: sudo bash scripts/test-mail-send.sh DOMAIN MAILBOX_USER RECIPIENT
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:?domain}"
USER_LOCAL="${2:?mailbox user e.g. info}"
TO="${3:?recipient@example.com}"

PAYLOAD="$(python3 -c "import json; print(json.dumps({'to':'$TO','subject':'Qadbak test','body':'Hello from Qadbak native mail.'}))")"

echo "==> mail-send $DOMAIN $USER_LOCAL -> $TO"
OUT="$(sudo -u "${QADBAK_USER:-qadbak}" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" \
  mail-send "$DOMAIN" "$USER_LOCAL" "$PAYLOAD" 2>&1 | tail -1)"
echo "$OUT" | python3 -m json.tool 2>/dev/null || echo "$OUT"

if echo "$OUT" | grep -q '"ok":true'; then
  echo "OK — queued via Postfix (check mail.log if delivery fails)"
else
  echo "FAIL — see message above" >&2
  exit 1
fi
