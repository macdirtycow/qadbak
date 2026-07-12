#!/usr/bin/env bash
# Repair panel webmail (IMAP read/send) on an existing server — run as root.
# Usage:
#   sudo bash scripts/repair-panel-webmail.sh
#   sudo bash scripts/repair-panel-webmail.sh example.com info
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
DOMAIN="${1:-}"
MAIL_USER="${2:-}"
ENV_FILE="$QADBAK_DIR/.env.local"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/repair-panel-webmail.sh [domain] [user]" >&2
  exit 1
fi

if [[ ! -d "$QADBAK_DIR" ]]; then
  echo "Missing $QADBAK_DIR — clone Qadbak first." >&2
  exit 1
fi

merge_env_feature() {
  local key="$1"
  local val="$2"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "WARN: $ENV_FILE not found — run install first." >&2
    return 0
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    if grep "^${key}=" "$ENV_FILE" | grep -qE "(^|,|\s)${val}(,|$|\s)"; then
      return 0
    fi
    sed -i.bak -E "s/^(${key}=.*)$/\1,${val}/" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    echo "==> Added ${val} to ${key}"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
    echo "==> Set ${key}=${val}"
  fi
}

echo "==> Webmail env (.env.local)"
merge_env_feature QADBAK_NATIVE_FEATURES imap
if [[ -f "$ENV_FILE" ]] && ! grep -q '^QADBAK_MAIL_BACKEND=' "$ENV_FILE" 2>/dev/null; then
  if grep '^QADBAK_PROVISIONER=' "$ENV_FILE" 2>/dev/null | grep -qiE 'native|hybrid'; then
    echo "QADBAK_MAIL_BACKEND=direct" >>"$ENV_FILE"
    echo "==> Set QADBAK_MAIL_BACKEND=direct"
  fi
fi
chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "==> Dovecot packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq dovecot-core dovecot-imapd 2>/dev/null || true
systemctl enable --now dovecot 2>/dev/null || systemctl enable --now dovecot-core 2>/dev/null || true

echo "==> Provisioning helper sudo"
if [[ -f "$QADBAK_DIR/scripts/configure-provisioning-helper-sudo.sh" ]]; then
  bash "$QADBAK_DIR/scripts/configure-provisioning-helper-sudo.sh"
fi

echo "==> Postfix + Dovecot maps"
if [[ -f "$QADBAK_DIR/scripts/configure-native-mail.sh" ]]; then
  bash "$QADBAK_DIR/scripts/configure-native-mail.sh" --force
fi
if id "$QADBAK_USER" &>/dev/null; then
  sudo -u "$QADBAK_USER" sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-sync \
    2>/dev/null || echo "    WARN: mail-sync failed (see above)" >&2
fi

if [[ -n "$DOMAIN" ]]; then
  echo "==> IMAP test $DOMAIN ${MAIL_USER:-}"
  bash "$QADBAK_DIR/scripts/check-imap-dovecot.sh" "$DOMAIN" "$MAIL_USER" || true
else
  echo "==> IMAP (no domain arg — pass: sudo bash $0 example.com info)"
  bash "$QADBAK_DIR/scripts/check-imap-dovecot.sh" 2>/dev/null || true
fi

echo ""
echo "Next: pull latest panel + restart"
echo "  sudo bash $QADBAK_DIR/scripts/update-qadbak.sh"
echo "Then open: Domains → your-domain → Webmail (or IMAP → Open webmail)"
