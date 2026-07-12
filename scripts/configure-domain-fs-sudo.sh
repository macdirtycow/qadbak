#!/usr/bin/env bash
# Install sudoers rule for Qadbak native file manager (existing servers).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-fs-sudo.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$(readlink -f "$SCRIPT_DIR/lib")"
HELPER="$(readlink -f "$QADBAK_DIR/scripts/domain-fs-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-domain-fs-helper.sh")"
ALLOWLIST="$LIB_DIR/domain-fs-commands.txt"
GEN="$LIB_DIR/generate-sudoers-allowlist.sh"
WRITE="$LIB_DIR/write-wrapper-allowlist.sh"

if [[ ! -f "$HELPER" || ! -f "$WRAPPER" ]]; then
  echo "Missing helper or wrapper under $QADBAK_DIR/scripts — git pull first." >&2
  exit 1
fi

chmod 755 "$HELPER" "$GEN" "$WRITE"
bash "$WRITE" "$WRAPPER" "$ALLOWLIST" "domain-fs-helper.mjs"

SUDOERS="/etc/sudoers.d/qadbak-domain-fs"
bash "$GEN" "$QADBAK_USER" "$WRAPPER" "$ALLOWLIST" \
  "# Qadbak native file browser — per-command sudo" >"$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

pick_test_home() {
  local td u h reg
  for h in /home/*/public_html; do
    [[ -d "$h" ]] || continue
    u="$(basename "$(dirname "$h")")"
    case "$u" in
      syslog | www-data | backup | list | irc | gnats | nobody | qadbak) continue ;;
    esac
    echo "/home/$u"
    return
  done
  reg="$QADBAK_DIR/data/native-domains.json"
  if [[ -f "$reg" ]]; then
    u="$(grep -o '"user":"[^"]*"' "$reg" 2>/dev/null | head -1 | sed 's/"user":"//;s/"//')"
    if [[ -n "$u" && -d "/home/$u" ]]; then
      echo "/home/$u"
      return
    fi
  fi
  if [[ -f "$QADBAK_DIR/.env.local" ]]; then
    td="$(grep -E '^(TEST_DOMAIN|QADBAK_TEST_SERVER)=' "$QADBAK_DIR/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'")"
    if [[ -n "$td" && "$td" =~ \. ]]; then
      u="${td%%.*}"
      if [[ -d "/home/$u" ]]; then
        echo "/home/$u"
        return
      fi
    fi
  fi
  echo "/home"
}

verify_domain_fs_sudo() {
  local test_path="$1" out errf rc
  errf="$(mktemp)"
  rc=0
  out="$(sudo -u "$QADBAK_USER" sudo -n "$WRAPPER" list "$test_path" 2>"$errf")" || rc=$?
  if [[ "$rc" -eq 0 ]] && echo "$out" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
    rm -f "$errf"
    return 0
  fi
  rm -f "$errf"
  return 1
}

echo "==> Verify file helper sudo (must return ok JSON)"
TEST_HOME="$(pick_test_home)"
if ! verify_domain_fs_sudo "$TEST_HOME"; then
  echo "Check: cat $SUDOERS" >&2
  exit 1
fi

echo "OK — wrapper: $WRAPPER"
echo "     probe:   list $TEST_HOME"
