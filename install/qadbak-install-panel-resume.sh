#!/usr/bin/env bash
# Resume panel-only install after a mid-install failure.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash install/qadbak-install-panel-resume.sh" >&2
  exit 1
}

[[ -f "$QADBAK_DIR/.env.local" ]] || {
  echo "Missing $QADBAK_DIR/.env.local — run install/qadbak-install-panel.sh first." >&2
  exit 1
}

INSTALL_MODE="$(grep '^QADBAK_INSTALL_MODE=' "$QADBAK_DIR/.env.local" | cut -d= -f2- || true)"
if [[ "$INSTALL_MODE" != "panel-only" ]]; then
  echo "Not a panel-only install — use install/qadbak-install-resume.sh instead." >&2
  exit 1
fi

for s in configure-panel-pm2-sudo configure-updates-sudo; do
  [[ -f "$QADBAK_DIR/scripts/${s}.sh" ]] && bash "$QADBAK_DIR/scripts/${s}.sh"
done

bash "$QADBAK_DIR/scripts/pm2-restart-qadbak.sh"
bash "$QADBAK_DIR/scripts/post-install-verify.sh"

echo "OK — panel-only resume complete"
