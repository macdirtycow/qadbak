#!/usr/bin/env bash
# Test local inbound delivery (Postfix → Maildir). Does not use external MX.
# Usage: sudo bash scripts/test-mail-receive.sh DOMAIN MAILBOX_USER
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
[[ -d "$ROOT" ]] || ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/mail-postfix-paths.sh
. "$ROOT/scripts/lib/mail-postfix-paths.sh"
DOMAIN="${1:?domain}"
USER_LOCAL="${2:?mailbox user e.g. info}"
EMAIL="${USER_LOCAL}@${DOMAIN}"

echo "==> mail-receive-test $DOMAIN $USER_LOCAL"

ALIAS="$(postmap -q "$EMAIL" hash:/etc/postfix/qadbak-virtual 2>/dev/null || true)"
VBOX="$(postmap -q "$EMAIL" hash:/etc/postfix/qadbak-vmailbox 2>/dev/null || true)"
UIDMAP="$(postmap -q "$EMAIL" hash:/etc/postfix/qadbak-vmailbox-uid 2>/dev/null || true)"
GIDMAP="$(postmap -q "$EMAIL" hash:/etc/postfix/qadbak-vmailbox-gid 2>/dev/null || true)"
echo "    qadbak-virtual: ${ALIAS:-(none)}"
echo "    qadbak-vmailbox: ${VBOX:-MISSING}"
echo "    uid/gid: ${UIDMAP:-?}/${GIDMAP:-?}"
if [[ -n "$ALIAS" ]]; then
  echo "FAIL — $EMAIL still in qadbak-virtual (shadows vmailbox). Run configure --force" >&2
  exit 1
fi
if [[ -z "$VBOX" || -z "$UIDMAP" || -z "$GIDMAP" ]]; then
  echo "FAIL — incomplete vmailbox maps for $EMAIL — run mail-sync" >&2
  exit 1
fi

OUT="$(sudo -u "${QADBAK_USER:-qadbak}" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" \
  mail-receive-test "$DOMAIN" "$USER_LOCAL" 2>&1 | tail -1)"
echo "$OUT" | python3 -m json.tool 2>/dev/null || echo "$OUT"

if echo "$OUT" | grep -q '"delivered":true'; then
  echo "OK — message delivered to Maildir (check IMAP tab → INBOX)"
else
  echo "FAIL — local delivery did not reach Maildir cur/new" >&2
  echo "==> postfix write probe" >&2
  VBOX="$(postmap -q "$EMAIL" hash:/etc/postfix/qadbak-vmailbox 2>/dev/null || true)"
  if [[ -n "$VBOX" && -x "$ROOT/scripts/probe-postfix-maildir-write.sh" ]]; then
    PROBE_DIR="$(qadbak_absolute_maildir_from_vmbox "$VBOX")"
    bash "$ROOT/scripts/probe-postfix-maildir-write.sh" "$PROBE_DIR" "$USER_LOCAL" >&2 || true
  fi
  echo "==> recent postfix / apparmor log" >&2
  grep -iE "postfix|${EMAIL}|status=|apparmor|DENIED" /var/log/mail.log /var/log/syslog 2>/dev/null | tail -25 >&2 || \
    journalctl -u postfix --no-pager -n 30 2>/dev/null >&2 || true
  exit 1
fi
