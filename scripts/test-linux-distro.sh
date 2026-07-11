#!/usr/bin/env bash
# Unit tests for scripts/lib/linux-distro.sh (no root required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/linux-distro.sh
source "$ROOT/scripts/lib/linux-distro.sh"

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  OK   $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $label (expected '$expected', got '$actual')" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_native_supported() {
  local label="$1" expect="$2"
  if qadbak_os_is_supported_native; then
    [[ "$expect" == "yes" ]] && echo "  OK   $label" && PASS=$((PASS + 1)) || {
      echo "  FAIL $label (expected unsupported)" >&2
      FAIL=$((FAIL + 1))
    }
  else
    [[ "$expect" == "no" ]] && echo "  OK   $label" && PASS=$((PASS + 1)) || {
      echo "  FAIL $label (expected supported)" >&2
      FAIL=$((FAIL + 1))
    }
  fi
}

with_os_release() {
  local tmp
  tmp="$(mktemp -d)"
  cat >"$tmp/os-release" <<EOF
$1
EOF
  QADBAK_OS_RELEASE_FILE="$tmp/os-release"
  qadbak_load_os_release
  rm -rf "$tmp"
}

echo "==> linux-distro.sh tests"

with_os_release 'ID=ubuntu
VERSION_ID=22.04
VERSION_CODENAME=jammy
PRETTY_NAME="Ubuntu 22.04 LTS"'
assert_eq "ubuntu id" "ubuntu" "$QADBAK_OS_ID"
assert_eq "ubuntu pkg mgr" "apt" "$QADBAK_PKG_MGR"
assert_native_supported "ubuntu 22.04 native" "yes"
assert_eq "ubuntu 22.04 php extra includes 8.1" "php8.1-fpm php8.1-cli" "$(qadbak_php_extra_apt_packages)"

with_os_release 'ID=ubuntu
VERSION_ID=26.04
VERSION_CODENAME=noble
PRETTY_NAME="Ubuntu 26.04 LTS"'
assert_native_supported "ubuntu 26.04 native" "yes"
assert_eq "ubuntu 26.04 php extra includes 8.4" "php8.4-fpm php8.4-cli php8.4-mysql php8.4-curl php8.4-xml php8.4-mbstring php8.4-zip" "$(qadbak_php_extra_apt_packages)"

with_os_release 'ID=debian
VERSION_ID=12
VERSION_CODENAME=bookworm
PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"'
assert_native_supported "debian 12 native" "yes"
assert_eq "debian pkg mgr" "apt" "$QADBAK_PKG_MGR"
assert_eq "debian 12 php extra includes 8.2" "php8.2-fpm php8.2-cli php8.2-mysql php8.2-curl php8.2-xml php8.2-mbstring php8.2-zip" "$(qadbak_php_extra_apt_packages)"

with_os_release 'ID=debian
VERSION_ID=11
VERSION_CODENAME=bullseye
PRETTY_NAME="Debian 11"'
assert_native_supported "debian 11 not native" "no"

with_os_release 'ID=fedora
VERSION_ID=41
VERSION_CODENAME=
PRETTY_NAME="Fedora Linux 41"'
assert_eq "fedora pkg mgr" "dnf" "$QADBAK_PKG_MGR"
assert_native_supported "fedora not native" "no"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
