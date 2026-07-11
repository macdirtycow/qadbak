#!/usr/bin/env bash
# Ubuntu LTS in-place release upgrade (one hop: 22.04→24.04 or 24.04→26.04).
# Used by the admin Updates tab via update-status-helper.mjs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$(dirname "$SCRIPT_DIR")}"
# shellcheck source=lib/linux-distro.sh
source "$SCRIPT_DIR/lib/linux-distro.sh"

usage() {
  cat <<'EOF'
Usage:
  ubuntu-release-upgrade.sh status-json
  ubuntu-release-upgrade.sh preflight TARGET_VERSION
  ubuntu-release-upgrade.sh run TARGET_VERSION

TARGET_VERSION must be the next LTS only (22.04→24.04, 24.04→26.04).
EOF
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || {
    echo "Run as root." >&2
    exit 1
  }
}

require_ubuntu() {
  qadbak_load_os_release || {
    echo "Cannot read /etc/os-release." >&2
    exit 1
  }
  if [[ "$QADBAK_OS_ID" != "ubuntu" ]]; then
    echo "Release upgrade is only supported on Ubuntu (this host: ${QADBAK_OS_PRETTY_NAME:-unknown})." >&2
    exit 1
  fi
}

validate_target() {
  local target="$1"
  local next=""
  next="$(qadbak_ubuntu_next_lts_version 2>/dev/null || true)"
  if [[ -z "$next" ]]; then
    echo "Ubuntu ${QADBAK_OS_VERSION_ID} has no supported in-place LTS upgrade from Qadbak." >&2
    exit 1
  fi
  if [[ "$target" != "$next" ]]; then
    echo "From Ubuntu ${QADBAK_OS_VERSION_ID} only ${next} is supported in one step (not ${target})." >&2
    echo "To reach a later LTS, upgrade one release at a time and repeat from the panel." >&2
    exit 1
  fi
}

ensure_upgrader() {
  export DEBIAN_FRONTEND=noninteractive
  qadbak_pkg_update || true
  qadbak_pkg_install ubuntu-release-upgrader-core lsb-release || true
  if [[ -f /etc/update-manager/release-upgrades ]]; then
    if grep -q '^Prompt=' /etc/update-manager/release-upgrades; then
      sed -i 's/^Prompt=.*/Prompt=lts/' /etc/update-manager/release-upgrades
    else
      echo "Prompt=lts" >>/etc/update-manager/release-upgrades
    fi
  fi
}

check_release_available() {
  local out=""
  local available=0
  local summary=""
  if ! command -v do-release-upgrade &>/dev/null; then
    echo "0|ubuntu-release-upgrader-core not installed"
    return 0
  fi
  if ! out="$(do-release-upgrade -c 2>&1)"; then
    summary="$(echo "$out" | tail -3 | tr '\n' ' ' | sed 's/  */ /g')"
    echo "0|${summary:-Release check failed}"
    return 0
  fi
  summary="$(echo "$out" | tail -5 | tr '\n' ' ' | sed 's/  */ /g')"
  if echo "$out" | grep -qiE 'new release|can be upgraded|upgrade is available'; then
    available=1
  fi
  echo "${available}|${summary:-Checked}"
}

disk_free_mb() {
  df -Pm / | awk 'NR==2 { print $4 }'
}

cmd_status_json() {
  require_ubuntu
  local next="" final="" available=0 check_summary="" disk_mb=0
  local install_mode="native"
  local env_file="$QADBAK_DIR/.env.local"
  if [[ -f "$env_file" ]] && grep -q '^QADBAK_INSTALL_MODE=panel-only' "$env_file"; then
    install_mode="panel-only"
  fi

  next="$(qadbak_ubuntu_next_lts_version 2>/dev/null || true)"
  if [[ "$QADBAK_OS_VERSION_ID" == "22.04" ]]; then
    final="26.04"
  fi

  if [[ -n "$next" ]]; then
    IFS='|' read -r available check_summary < <(check_release_available)
  fi
  disk_mb="$(disk_free_mb 2>/dev/null || echo 0)"

  local issues_json="[]"
  if [[ "$install_mode" == "panel-only" ]]; then
    issues_json='["Panel-only install — use a full native stack VPS for OS release upgrades."]'
  elif [[ -z "$next" ]]; then
    issues_json='["Already on the latest supported Ubuntu LTS for in-place upgrade."]'
  fi

  cat <<EOF
{
  "supported": $([[ "$QADBAK_OS_ID" == "ubuntu" && "$install_mode" != "panel-only" ]] && echo true || echo false),
  "installMode": "$install_mode",
  "current": {
    "version": "$QADBAK_OS_VERSION_ID",
    "codename": "$QADBAK_OS_CODENAME",
    "pretty": "$QADBAK_OS_PRETTY_NAME"
  },
  "nextTarget": $(
    if [[ -n "$next" ]]; then
      printf '{"version":"%s","codename":"%s","label":"%s"}' \
        "$next" "$(qadbak_ubuntu_lts_codename "$next")" "$(qadbak_ubuntu_lts_label "$next")"
    else
      echo "null"
    fi
  ),
  "finalTarget": $(
    if [[ -n "$final" && "$QADBAK_OS_VERSION_ID" == "22.04" ]]; then
      printf '{"version":"%s","codename":"%s","label":"%s"}' \
        "$final" "$(qadbak_ubuntu_lts_codename "$final")" "$(qadbak_ubuntu_lts_label "$final")"
    else
      echo "null"
    fi
  ),
  "upgradeAvailable": $([[ "$available" == "1" ]] && echo true || echo false),
  "checkSummary": $(printf '%s' "$check_summary" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
  "diskFreeMb": $disk_mb,
  "issues": $issues_json
}
EOF
}

cmd_preflight() {
  local target="${1:-}"
  require_root
  require_ubuntu
  [[ -n "$target" ]] || {
    echo "Missing TARGET_VERSION." >&2
    exit 1
  }
  validate_target "$target"

  local issues=()
  local ok=1
  local upgradable=0 reboot=0 available=0 check_summary=""

  if [[ -f "$QADBAK_DIR/.env.local" ]] && grep -q '^QADBAK_INSTALL_MODE=panel-only' "$QADBAK_DIR/.env.local"; then
    issues+=("Panel-only install cannot run OS release upgrades on this host.")
    ok=0
  fi

  if command -v apt-get &>/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq || issues+=("apt-get update failed — fix apt sources first.")
    if out="$(apt-get -s upgrade 2>/dev/null || true)"; then
      upgradable="$(echo "$out" | grep -oE '^[0-9]+ upgraded' | head -1 | awk '{print $1}' || echo 0)"
      [[ -z "$upgradable" ]] && upgradable=0
      if [[ "$upgradable" -gt 0 ]]; then
        issues+=("${upgradable} package update(s) pending — install them before upgrading Ubuntu.")
        ok=0
      fi
    fi
  fi

  [[ -f /var/run/reboot-required ]] && {
    reboot=1
    issues+=("Reboot required before starting a release upgrade.")
    ok=0
  }

  local disk_mb
  disk_mb="$(disk_free_mb 2>/dev/null || echo 0)"
  if [[ "$disk_mb" -lt 4096 ]]; then
    issues+=("Low disk space on / (${disk_mb} MB free) — need at least ~4 GB.")
    ok=0
  fi

  IFS='|' read -r available check_summary < <(check_release_available)
  if [[ "$available" != "1" ]]; then
    issues+=("do-release-upgrade -c: no new LTS release reported yet (${check_summary}).")
    ok=0
  fi

  if pgrep -f 'do-release-upgrade|apt-get dist-upgrade' &>/dev/null; then
    issues+=("Another package upgrade is already running.")
    ok=0
  fi

  local issues_json="[]"
  if [[ ${#issues[@]} -gt 0 ]]; then
    issues_json="$(printf '%s\n' "${issues[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
  fi

  cat <<EOF
{
  "target": "$target",
  "preflightOk": $([[ "$ok" -eq 1 ]] && echo true || echo false),
  "packageUpdatesPending": $upgradable,
  "rebootRequired": $([[ "$reboot" -eq 1 ]] && echo true || echo false),
  "upgradeAvailable": $([[ "$available" == "1" ]] && echo true || echo false),
  "checkSummary": $(printf '%s' "$check_summary" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
  "diskFreeMb": $disk_mb,
  "issues": $issues_json
}
EOF
}

cmd_run() {
  local target="${1:-}"
  require_root
  require_ubuntu
  validate_target "$target"

  export DEBIAN_FRONTEND=noninteractive
  export PYTHONUNBUFFERED=1
  export NEEDRESTART_MODE=a

  echo "==> Preparing packages before Ubuntu ${QADBAK_OS_VERSION_ID} → ${target}"
  qadbak_pkg_update
  apt-get upgrade -y
  apt-get dist-upgrade -y

  ensure_upgrader

  echo "==> Starting do-release-upgrade to Ubuntu ${target} (non-interactive)"
  do-release-upgrade -f DistUpgradeViewNonInteractive

  echo "==> Release upgrade finished — repairing Qadbak stack"
  if [[ -f "$QADBAK_DIR/scripts/post-ubuntu-release-upgrade.sh" ]]; then
    bash "$QADBAK_DIR/scripts/post-ubuntu-release-upgrade.sh"
  fi

  qadbak_load_os_release
  echo "==> Now running: $(qadbak_linux_release_label)"

  if [[ -f /var/run/reboot-required ]]; then
    echo "==> Reboot required — scheduling in 3 minutes"
    shutdown -r +3 "Ubuntu release upgrade complete — rebooting" || true
  fi
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    status-json) cmd_status_json ;;
    preflight)
      shift
      cmd_preflight "${1:-}"
      ;;
    run)
      shift
      cmd_run "${1:-}"
      ;;
    -h | --help | help) usage ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
