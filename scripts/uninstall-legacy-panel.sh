#!/usr/bin/env bash
# Remove legacy GPL hosting panel packages after Qadbak native mode is verified.
# Keeps nginx, Apache, Postfix, Dovecot, MariaDB, BIND, and customer data.
#
# Usage:
#   sudo bash scripts/uninstall-legacy-panel.sh
#   sudo bash scripts/uninstall-legacy-panel.sh --yes
#   sudo bash scripts/uninstall-legacy-panel.sh --dry-run
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
DRY=0
YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --yes|-y) YES=1 ;;
  esac
done

run() {
  if [[ "$DRY" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/uninstall-legacy-panel.sh" >&2
  exit 1
fi

echo "============================================"
echo " Remove legacy hosting panel packages"
echo "============================================"
echo " Qadbak and customer sites (nginx, mail, DB) stay installed."
echo " Recommended: snapshot or backup this VPS first."
echo ""

if [[ "$YES" -ne 1 && "$DRY" -ne 1 ]]; then
  read -rp "Continue? [y/N]: " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo "==> Qadbak native preflight"
if [[ -f "$QADBAK_DIR/scripts/preflight-phase8-independent.sh" ]]; then
  if ! bash "$QADBAK_DIR/scripts/preflight-phase8-independent.sh"; then
    echo "Preflight failed — fix the panel before removing legacy packages." >&2
    echo "  sudo bash $QADBAK_DIR/scripts/apply-phase8-independent.sh" >&2
    exit 1
  fi
else
  echo "WARN: preflight script missing — ensure QADBAK_PROVISIONER=native works." >&2
fi

echo "==> Stop legacy panel services"
run systemctl stop webmin 2>/dev/null || true
run systemctl stop usermin 2>/dev/null || true
run systemctl disable webmin 2>/dev/null || true
run systemctl disable usermin 2>/dev/null || true

echo "==> Remove apt packages (webmin, virtualmin-*)"
if command -v apt-get >/dev/null 2>&1; then
  run apt-get remove -y --purge \
    webmin usermin \
    virtualmin-base virtualmin-core virtualmin-lamp-stack virtualmin-lemp-stack \
    virtualmin-config virtualmin-wizard virtualmin-install 2>/dev/null || true
  run dpkg -l 'virtualmin-*' 2>/dev/null | awk '/^ii/{print $2}' | xargs -r apt-get remove -y --purge 2>/dev/null || true
  run apt-get autoremove -y
  run apt-get autoclean -y
elif command -v dnf >/dev/null 2>&1; then
  run dnf remove -y webmin usermin virtualmin-release 2>/dev/null || true
else
  echo "Unknown package manager — remove legacy panel packages manually." >&2
  exit 1
fi

echo "==> Panel .env.local (native only)"
ENV_FILE="$QADBAK_DIR/.env.local"
if [[ -f "$ENV_FILE" && "$DRY" -ne 1 ]]; then
  cp -a "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  grep -v -E '^(VIRTUALMIN_|WEBMIN_|USERMIN_|VIRTUALMIN_UI_)' "$ENV_FILE" >"${ENV_FILE}.tmp" || true
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  for kv in \
    "QADBAK_PROVISIONER=native" \
    "QADBAK_VIRTUALMIN_FALLBACK=false" \
    "QADBAK_DISABLE_WEBMIN=true" \
    "QADBAK_NATIVE_INSTALL=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
      sed -i "s|^${key}=.*|${kv}|" "$ENV_FILE"
    else
      echo "$kv" >>"$ENV_FILE"
    fi
  done
  chown "$QADBAK_USER:$QADBAK_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
elif [[ "$DRY" -eq 1 ]]; then
  echo "[dry-run] strip legacy API keys from .env.local; set QADBAK_PROVISIONER=native"
fi

echo "==> Panel nginx"
if [[ -x "$QADBAK_DIR/scripts/fix-panel-nginx-port.sh" ]]; then
  run bash "$QADBAK_DIR/scripts/fix-panel-nginx-port.sh"
fi

if [[ "$DRY" -ne 1 ]]; then
  echo "==> Restart Qadbak"
  bash "$QADBAK_DIR/scripts/ensure-terminal-deps.sh" || true
  bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh" || true
fi

echo ""
echo "OK — legacy panel packages removed (or dry-run logged)."
echo "  Customer sites: unchanged."
echo "  Panel health: curl -s http://127.0.0.1:3000/api/health"
echo "  Optional: rm -rf /etc/webmin /usr/share/webmin /var/webmin"
