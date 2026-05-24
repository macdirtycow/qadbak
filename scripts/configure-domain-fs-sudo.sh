#!/usr/bin/env bash
# Install sudoers rule for Qadbak native file manager (existing servers).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/configure-domain-fs-sudo.sh" >&2
  exit 1
fi

HELPER="$(readlink -f "$QADBAK_DIR/scripts/domain-fs-helper.mjs")"
WRAPPER="$(readlink -f "$QADBAK_DIR/scripts/run-domain-fs-helper.sh")"
if [[ ! -f "$HELPER" || ! -f "$WRAPPER" ]]; then
  echo "Missing helper or wrapper under $QADBAK_DIR/scripts — git pull first." >&2
  exit 1
fi

NODE_BIN="$(sudo -u "$QADBAK_USER" -H bash -lc 'command -v node' 2>/dev/null | head -1)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi
if [[ -z "$NODE_BIN" ]]; then
  echo "node not found for user $QADBAK_USER" >&2
  exit 1
fi
NODE_BIN="$(readlink -f "$NODE_BIN")"

chmod 755 "$HELPER" "$WRAPPER"
if grep -q '^QADBAK_NODE_BIN=' "$WRAPPER"; then
  sed -i "s|^QADBAK_NODE_BIN=.*|QADBAK_NODE_BIN=$NODE_BIN|" "$WRAPPER"
else
  sed -i "2i QADBAK_NODE_BIN=$NODE_BIN" "$WRAPPER"
fi

SUDOERS="/etc/sudoers.d/qadbak-domain-fs"
cat >"$SUDOERS" <<EOF
# Qadbak native file browser — list/read/write under /home/
$QADBAK_USER ALL=(root) NOPASSWD: $WRAPPER *
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

pick_test_home() {
  local td u h reg
  # Prefer a real hosting user (public_html), not system accounts like syslog.
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
  if command -v virtualmin &>/dev/null; then
    td="$(virtualmin list-domains --name-only 2>/dev/null | sed '/^$/d' | grep -E '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' | head -1 || true)"
    if [[ -n "$td" ]]; then
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
  echo "FAILED verify list $test_path (qadbak → sudo -n wrapper)" >&2
  echo "  exit=$rc stdout=${out:-<empty>}" >&2
  echo "  stderr=$(tr '\n' ' ' <"$errf" 2>/dev/null || true)" >&2
  rm -f "$errf"
  errf="$(mktemp)"
  if out="$(sudo -n "$WRAPPER" list "$test_path" 2>"$errf")" && echo "$out" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "  hint: wrapper works as root; check sudoers for user $QADBAK_USER" >&2
  else
    echo "  hint: wrapper as root also failed — node=$NODE_BIN" >&2
    echo "  root stderr=$(tr '\n' ' ' <"$errf" 2>/dev/null || true)" >&2
  fi
  rm -f "$errf"
  return 1
}

echo "==> Verify file helper sudo (must return ok JSON)"
TEST_HOME="$(pick_test_home)"
if ! verify_domain_fs_sudo "$TEST_HOME"; then
  echo "Check:" >&2
  echo "  cat $SUDOERS" >&2
  echo "  sudo -u $QADBAK_USER sudo -l" >&2
  exit 1
fi

echo "OK — wrapper: $WRAPPER"
echo "     node:    $NODE_BIN"
echo "     probe:   list $TEST_HOME"
