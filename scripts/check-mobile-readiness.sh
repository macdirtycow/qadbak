#!/usr/bin/env bash
# Verify panel VPS is ready for the Qadbak iOS app (auth, Qmail, push, files).
# Usage:
#   sudo bash scripts/check-mobile-readiness.sh
#   sudo bash scripts/check-mobile-readiness.sh example.com info
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
DOMAIN="${1:-}"
MAILBOX="${2:-info}"
ENV_FILE="$ROOT/.env.local"
FAIL=0

warn() { echo "  WARN: $*" >&2; FAIL=1; }
ok() { echo "  OK: $*"; }
miss() { echo "  MISSING: $*" >&2; FAIL=1; }

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/check-mobile-readiness.sh [domain] [mailbox]" >&2
  exit 1
}

echo "==> Qadbak iOS / mobile readiness"
echo "    panel: $ROOT"

echo ""
echo "==> License server"
if curl -sf "${QADBAK_LICENSE_SERVER:-https://license.omiiba.dev}/health" >/dev/null; then
  ok "license server reachable"
else
  warn "cannot reach license server"
fi

echo ""
echo "==> Premium features (.env.local)"
ALL_FEATURES=(
  white-label client-rbac multi-tenant-clients panel-client-vhost
  admin-updates php-fpm-isolation dashboard-panel-control offsite-backup webmail-ui
)
if [[ -f "$ENV_FILE" ]]; then
  PREMIUM_LINE="$(grep '^QADBAK_PREMIUM_FEATURES=' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -n "$PREMIUM_LINE" ]]; then
    for f in "${ALL_FEATURES[@]}"; do
      if echo "$PREMIUM_LINE" | grep -qE "(^|,)$f(,|$)"; then
        ok "premium feature: $f"
      else
        miss "premium feature: $f"
      fi
    done
  else
    miss "QADBAK_PREMIUM_FEATURES not set"
  fi
else
  miss ".env.local not found"
fi

echo ""
echo "==> Native IMAP (Qmail)"
if [[ -f "$ENV_FILE" ]] && grep '^QADBAK_NATIVE_FEATURES=' "$ENV_FILE" | grep -qE '(^|,)(imap)(,|$)'; then
  ok "imap in QADBAK_NATIVE_FEATURES"
else
  miss "imap not in QADBAK_NATIVE_FEATURES"
fi
if command -v doveadm >/dev/null 2>&1; then
  ok "doveadm installed"
else
  warn "doveadm not found — Dovecot may be missing"
fi

echo ""
echo "==> APNs push"
for key in QADBAK_APNS_KEY_ID QADBAK_APNS_TEAM_ID; do
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    ok "$key set"
  else
    warn "$key not set (push alerts disabled)"
  fi
done
if grep -qE '^QADBAK_APNS_KEY_(PATH|P8)=' "$ENV_FILE" 2>/dev/null; then
  ok "APNs signing key configured"
else
  warn "QADBAK_APNS_KEY_PATH or QADBAK_APNS_KEY_P8 not set"
fi

echo ""
echo "==> Live files browser"
if grep -q '^QADBAK_LIVE_FILES=false' "$ENV_FILE" 2>/dev/null; then
  warn "QADBAK_LIVE_FILES=false — iOS files module disabled"
elif [[ -x "$ROOT/scripts/configure-domain-fs-sudo.sh" ]]; then
  ok "live files enabled (run configure-domain-fs-sudo.sh if listing fails)"
else
  warn "configure-domain-fs-sudo.sh missing"
fi

echo ""
echo "==> Mobile auth data files"
for f in mobile-refresh-tokens.json mobile-push-tokens.json; do
  if [[ -f "$ROOT/data/$f" ]]; then
    ok "data/$f present"
  else
    echo "  note: data/$f will be created on first mobile login/push"
  fi
done

if [[ -n "$DOMAIN" ]]; then
  echo ""
  echo "==> Webmail probe for $DOMAIN (mailbox: $MAILBOX)"
  if [[ -f "$ROOT/scripts/repair-panel-webmail.sh" ]]; then
    bash "$ROOT/scripts/repair-panel-webmail.sh" "$DOMAIN" "$MAILBOX" || warn "webmail repair failed for $DOMAIN"
  else
    warn "repair-panel-webmail.sh not found"
  fi
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Ready for Qadbak iOS app."
  exit 0
fi
echo "Some checks failed — run: sudo bash scripts/repair-panel-premium.sh ${DOMAIN:+$DOMAIN}"
exit 1
