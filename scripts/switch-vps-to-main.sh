#!/usr/bin/env bash
# Point a production VPS at public main (installer fixes, BIND auto-zones, Playwright E2E).
# Safe to run after an install that used macdirtycow/proprietary-premium-commercialization.
set -euo pipefail
ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
ENV="$ROOT/.env.local"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $ROOT/scripts/switch-vps-to-main.sh" >&2
  exit 1
fi

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Not a git checkout: $ROOT" >&2
  exit 1
fi

if [[ -f "$ENV" ]]; then
  if grep -q '^QADBAK_GIT_BRANCH=' "$ENV"; then
    sed -i 's/^QADBAK_GIT_BRANCH=.*/QADBAK_GIT_BRANCH=main/' "$ENV"
  else
    echo "QADBAK_GIT_BRANCH=main" >>"$ENV"
  fi
  chown "$USER:$USER" "$ENV"
  chmod 600 "$ENV"
fi

echo "==> Switch VPS git branch to main"
bash "$ROOT/scripts/git-sync-origin.sh"
bash "$ROOT/scripts/fix-qadbak-ownership.sh"
echo ""
echo "OK — now on: $(git -C "$ROOT" rev-parse --abbrev-ref HEAD) @ $(git -C "$ROOT" rev-parse --short HEAD)"
echo "Next: sudo bash $ROOT/scripts/update-qadbak.sh"
