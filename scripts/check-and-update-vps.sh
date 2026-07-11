#!/usr/bin/env bash
# Check Qadbak VPS git status and run update-qadbak.sh when behind origin.
set -euo pipefail

PANEL_VPS="${PANEL_VPS:-root@158.220.85.245}"
LICENSE_VPS="${LICENSE_VPS:-root@80.190.83.198}"
REMOTE_QADBAK="${REMOTE_QADBAK:-/opt/qadbak}"
LOCAL_MAIN="$(git -C "$(cd "$(dirname "$0")/.." && pwd)" rev-parse origin/main 2>/dev/null || git rev-parse HEAD)"

ssh_check() {
  local host="$1"
  ssh -o BatchMode=yes -o ConnectTimeout=15 "$host" "$2"
}

check_panel() {
  echo "==> Panel VPS ($PANEL_VPS)"
  ssh_check "$PANEL_VPS" "
    set -e
    hostname
    cd '$REMOTE_QADBAK'
    git fetch origin -q
    local=\$(git rev-parse HEAD)
    remote=\$(git rev-parse origin/main)
    behind=\$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
    echo \"  local:  \$local\"
    echo \"  remote: \$remote\"
    echo \"  behind: \$behind commit(s)\"
    if [[ \"\$behind\" -gt 0 ]]; then
      echo '  ACTION: update needed'
      exit 2
    fi
    echo '  OK: up to date'
  "
}

update_panel() {
  echo "==> Updating panel VPS ($PANEL_VPS)"
  ssh_check "$PANEL_VPS" "cd '$REMOTE_QADBAK' && sudo bash scripts/update-qadbak.sh"
}

check_license_qadbak() {
  echo "==> License VPS qadbak ($LICENSE_VPS)"
  ssh_check "$LICENSE_VPS" "
    if [[ -d '$REMOTE_QADBAK/.git' ]]; then
      cd '$REMOTE_QADBAK'
      git fetch origin -q
      behind=\$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
      echo \"  behind: \$behind commit(s)\"
      [[ \"\$behind\" -gt 0 ]] && exit 2 || exit 0
    fi
    echo '  (no /opt/qadbak — license-server only)'
  " || true
}

main() {
  echo "Local origin/main: $LOCAL_MAIN"
  echo ""

  needs_update=0
  if check_panel; then
    :
  else
    rc=$?
    if [[ "$rc" -eq 2 ]]; then needs_update=1; else exit "$rc"; fi
  fi

  check_license_qadbak || true

  if [[ "$needs_update" -eq 1 ]]; then
    echo ""
    update_panel
    echo ""
    echo "✓ Panel VPS updated."
  else
    echo ""
    echo "✓ Panel VPS already on latest main."
  fi
}

main "$@"
