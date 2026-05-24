#!/usr/bin/env bash
# Trace why external mail is not in INBOX (Postfix → LMTP → Maildir → Dovecot).
# Usage: sudo bash scripts/trace-inbound-mail.sh DOMAIN MAILBOX_USER
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:?domain e.g. example.com}"
USER_LOCAL="${2:-info}"

[[ -f "$ROOT/.env.local" ]] && source "$ROOT/.env.local"

echo "========== 1. Postfix hostname (must be FQDN, not IP) =========="
postconf -h myhostname myorigin append_at_myorigin 2>/dev/null || true
MYH="$(postconf -h myhostname 2>/dev/null || true)"
if [[ "$MYH" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "FAIL — myhostname is still IP: $MYH"
  echo "      Run: sudo bash scripts/configure-native-mail.sh --force"
else
  echo "OK — myhostname=$MYH"
fi

echo ""
echo "========== 2. Virtual map lookup =========="
VALIAS="$(postmap -q "${USER_LOCAL}@${DOMAIN}" hash:/etc/postfix/qadbak-virtual 2>/dev/null || true)"
VBOX="$(postmap -q "${USER_LOCAL}@${DOMAIN}" hash:/etc/postfix/qadbak-vmailbox 2>/dev/null || true)"
echo "qadbak-virtual (must be empty for mailboxes): ${VALIAS:-OK — none}"
echo "qadbak-vmailbox: ${VBOX:-MISSING}"
if [[ -n "$VALIAS" ]]; then
  echo "FAIL — alias map shadows mailbox delivery. Run: sudo bash scripts/configure-native-mail.sh --force"
fi
postmap -q "${DOMAIN}" hash:/etc/postfix/qadbak-domains 2>/dev/null || echo "(domain not in qadbak-domains)"

echo ""
echo "========== 3. Unix user + Maildir on disk =========="
if getent passwd "$USER_LOCAL" >/dev/null; then
  UHOME="$(getent passwd "$USER_LOCAL" | cut -d: -f6)"
  echo "passwd $USER_LOCAL → home $UHOME"
  for sub in new cur tmp; do
    n="$(find "$UHOME/Maildir/$sub" -type f 2>/dev/null | wc -l | tr -d ' ')"
    echo "  $UHOME/Maildir/$sub → $n file(s)"
  done
else
  echo "WARN — unix user $USER_LOCAL does not exist"
fi

OWNER="$(grep -o '"user":"[^"]*"' "$ROOT/data/native-domains.json" 2>/dev/null | head -1 | sed 's/"user":"//;s/"//' || true)"
if [[ -n "$OWNER" && "$USER_LOCAL" != "$OWNER" ]]; then
  ALT="/home/$OWNER/homes/$USER_LOCAL/Maildir"
  echo "Qadbak layout path (may differ from passwd): $ALT"
  for sub in new cur; do
    n="$(find "$ALT/$sub" -type f 2>/dev/null | wc -l | tr -d ' ')"
    echo "  $ALT/$sub → $n file(s)"
  done
fi

echo ""
echo "========== 4. Postfix queue =========="
postqueue -p 2>/dev/null | head -20 || mailq 2>/dev/null | head -20 || echo "(empty or postqueue unavailable)"

echo ""
echo "========== 5. Recent mail.log (this recipient) =========="
grep -i "${USER_LOCAL}@${DOMAIN}\|${USER_LOCAL}" /var/log/mail.log 2>/dev/null | tail -25 || \
  journalctl -u postfix -u dovecot --no-pager -n 30 2>/dev/null || true

echo ""
echo "========== 6. Qadbak probes =========="
sudo -u "${QADBAK_USER:-qadbak}" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" \
  mail-diagnose "$DOMAIN" "$USER_LOCAL" 2>&1 | tail -1 | python3 -m json.tool 2>/dev/null || true

echo ""
echo "========== 7. Local delivery test =========="
bash "$ROOT/scripts/test-mail-receive.sh" "$DOMAIN" "$USER_LOCAL" || true

echo ""
echo "If step 1 FAIL → configure-native-mail.sh --force"
echo "If step 3 shows files in passwd Maildir but panel empty → git pull (maildir path fix)"
echo "If step 5 empty and external mail sent → MX/DNS or provider firewall TCP 25"
