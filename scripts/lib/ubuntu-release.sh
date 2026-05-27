#!/usr/bin/env bash
# Ubuntu LTS detection for install scripts (22.04 Jammy, 24.04 Noble).
# shellcheck shell=bash

# Populated by qadbak_detect_ubuntu_release
QADBAK_UBUNTU_VERSION_ID="${QADBAK_UBUNTU_VERSION_ID:-}"
QADBAK_UBUNTU_CODENAME="${QADBAK_UBUNTU_CODENAME:-}"

qadbak_detect_ubuntu_release() {
  QADBAK_UBUNTU_VERSION_ID=""
  QADBAK_UBUNTU_CODENAME=""
  if [[ ! -f /etc/os-release ]]; then
    return 1
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    return 1
  fi
  QADBAK_UBUNTU_VERSION_ID="${VERSION_ID:-}"
  QADBAK_UBUNTU_CODENAME="${VERSION_CODENAME:-}"
  case "$QADBAK_UBUNTU_VERSION_ID" in
    22.04 | 24.04) return 0 ;;
    *)
      echo "WARN: Ubuntu $QADBAK_UBUNTU_VERSION_ID is not in the tested LTS list (22.04, 24.04)" >&2
      return 1
      ;;
  esac
}

qadbak_ubuntu_release_label() {
  if [[ -n "$QADBAK_UBUNTU_VERSION_ID" ]]; then
    echo "Ubuntu ${QADBAK_UBUNTU_VERSION_ID} (${QADBAK_UBUNTU_CODENAME})"
  else
    echo "Ubuntu"
  fi
}

# bind9utils (Jammy) vs bind9-utils (Noble)
qadbak_bind_apt_packages() {
  if apt-cache show bind9utils &>/dev/null 2>&1; then
    echo "bind9 bind9utils"
  else
    echo "bind9 bind9-utils"
  fi
}

# Extra PHP FPM packages worth installing per release (meta php-fpm is usually enough).
qadbak_php_extra_apt_packages() {
  case "$QADBAK_UBUNTU_VERSION_ID" in
    24.04) echo "php8.3-fpm php8.3-cli php8.3-mysql php8.3-curl php8.3-xml php8.3-mbstring php8.3-zip" ;;
    22.04) echo "php8.1-fpm php8.1-cli" ;;
    *) echo "" ;;
  esac
}

# awscli (v1) exists on Jammy; Noble removed it — try apt, then snap, else warn.
qadbak_install_aws_cli() {
  if command -v aws &>/dev/null; then
    echo "  OK   aws CLI already on PATH"
    return 0
  fi
  if apt-cache show awscli &>/dev/null 2>&1; then
    if apt-get install -y -qq awscli 2>/dev/null; then
      apt-mark manual awscli 2>/dev/null || true
      echo "  OK   awscli (apt)"
      return 0
    fi
  fi
  if command -v snap &>/dev/null && snap install aws-cli --classic 2>/dev/null; then
    ln -sf /snap/bin/aws /usr/local/bin/aws 2>/dev/null || true
    echo "  OK   aws-cli (snap)"
    return 0
  fi
  echo "  WARN aws CLI not installed (optional — S3 backup tab needs it)" >&2
  echo "       Install later: snap install aws-cli --classic" >&2
  return 0
}
