#!/usr/bin/env bash
# Dovecot IMAP diagnostics for Qadbak native imap module.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
DOMAIN="${1:-}"
USER_LOCAL="${2:-}"

[[ -f "$ROOT/.env.local" ]] && source "$ROOT/.env.local"

echo "==> Dovecot package"
if ! command -v doveadm &>/dev/null; then
  echo "FAIL — install: apt install dovecot-core dovecot-imapd" >&2
  exit 1
fi
# Dovecot 2.3 uses doveadm -V (not --version)
VER="$(doveadm -V 2>/dev/null | head -1 || true)"
if [[ -z "$VER" ]]; then
  VER="$(dovecot --version 2>/dev/null | head -1 || echo "doveadm installed")"
fi
echo "$VER"

echo "==> Dovecot service"
systemctl is-active dovecot 2>/dev/null || systemctl is-active dovecot-core 2>/dev/null || echo "WARN — dovecot not active"

if [[ -n "$DOMAIN" ]]; then
  echo "==> Qadbak imap-list $DOMAIN ${USER_LOCAL:-}"
  OUT="$(sudo -u "${QADBAK_USER:-qadbak}" sudo -n "$ROOT/scripts/run-provisioning-helper.sh" \
    imap-list "$DOMAIN" "${USER_LOCAL:-}" 2>&1 | tail -1)"
  echo "$OUT" | python3 -m json.tool 2>/dev/null || echo "$OUT"
  if echo "$OUT" | grep -q '"source":"doveadm"'; then
    echo "    OK — doveadm IMAP"
  elif echo "$OUT" | grep -q '"source":"maildir"'; then
    echo "    WARN — using Maildir fallback (doveadm auth user not resolved; try another mailbox user)"
  fi
fi

echo "OK — native IMAP (see docs/IMAP-NATIVE.md)"
