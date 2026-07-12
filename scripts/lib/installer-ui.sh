#!/usr/bin/env bash
# Hestia-style installer UI helpers for Qadbak shell installers.
# shellcheck shell=bash

qadbak_install_version_from_repo() {
  local root="${1:-}"
  if [[ -z "$root" ]]; then
    return 1
  fi
  if [[ -f "$root/package.json" ]] && command -v node &>/dev/null; then
    node -p "require('$root/package.json').version" 2>/dev/null && return 0
  fi
  if [[ -f "$root/package.json" ]]; then
    sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$root/package.json" | head -1
    return 0
  fi
  return 1
}

qadbak_install_separator() {
  printf '%*s\n' 72 '' | tr ' ' '='
}

qadbak_install_banner() {
  local version="${QADBAK_INSTALL_VERSION:-}"
  echo ""
  cat <<'EOF'
               _           _       _           _
              | | __ _  __| | __ _| |__   __ _| |__
              | |/ _` |/ _` |/ _` | '_ \ / _` | '_ \
              | | (_| | (_| | (_| | |_) | (_| | |_) |
              |_|\__,_|\__,_|\__,_|_.__/ \__,_|_.__/

                    Qadbak Control Panel
EOF
  if [[ -n "$version" ]]; then
    printf '                          %s\n' "$version"
  fi
  echo "                     https://qadbak.com"
  echo ""
  qadbak_install_separator
  echo ""
}

qadbak_install_panel_banner() {
  local version="${QADBAK_INSTALL_VERSION:-}"
  echo ""
  cat <<'EOF'
               _           _       _           _
              | | __ _  __| | __ _| |__   __ _| |__
              | |/ _` |/ _` |/ _` | '_ \ / _` | '_ \
              | | (_| | (_| | (_| | |_) | (_| | |_) |
              |_|\__,_|\__,_|\__,_|_.__/ \__,_|_.__/

                 Qadbak Panel (UI only)
EOF
  if [[ -n "$version" ]]; then
    printf '                          %s\n' "$version"
  fi
  echo "                     https://qadbak.com"
  echo ""
  qadbak_install_separator
  echo ""
}

qadbak_install_full_components() {
  cat <<'EOF'
Thank you for downloading Qadbak! In a few moments,
we will begin installing the following components on your server:

   - NGINX Web / Proxy Server
   - Apache Web Server (as backend)
   - PHP-FPM Application Server
   - BIND DNS Server
   - Postfix Mail Server + Dovecot IMAP/POP3
   - MariaDB Database Server
   - ProFTPD FTP Server
   - Fail2Ban Access Monitor
   - Qadbak Panel (Node.js / Next.js)

EOF
  qadbak_install_separator
  echo ""
}

qadbak_install_panel_components() {
  cat <<'EOF'
Thank you for downloading Qadbak! In a few moments,
we will begin installing the panel UI on your server:

   - Node.js runtime
   - Qadbak Panel (Next.js + pm2)
   - Optional nginx reverse proxy

EOF
  qadbak_install_separator
  echo ""
}

qadbak_install_step() {
  echo "[ * ] $*"
}

qadbak_install_repo_line() {
  echo "[ * ] $*"
}

qadbak_install_note() {
  echo "NOTE: $*"
}

qadbak_install_warn() {
  echo "WARN: $*" >&2
}

qadbak_install_prompt_continue() {
  local prompt="${1:-Would you like to continue with the installation? [y/N]: }"
  read -rp "$prompt" _confirm
  if [[ ! "$_confirm" =~ ^[Yy]$ ]]; then
    exit 0
  fi
}

qadbak_install_prompt_username() {
  local var_name="${1:-QB_USER}"
  local default="${2:-admin}"
  local value=""
  while true; do
    read -rp "Please enter administrator username [$default]: " value
    value="${value:-$default}"
    if [[ "$value" =~ ^[a-z][a-z0-9_-]{0,31}$ ]]; then
      printf -v "$var_name" '%s' "$value"
      return 0
    fi
    echo "Please use a valid username (ex. user)."
  done
}

qadbak_install_prompt_password() {
  local var_name="${1:-QB_PASS}"
  local value=""
  while true; do
    read -rsp "Please enter administrator password: " value
    echo
    if [[ -n "$value" ]]; then
      printf -v "$var_name" '%s' "$value"
      return 0
    fi
    echo "Please enter a password."
  done
}

qadbak_install_prompt_email() {
  local var_name="${1:-LE_EMAIL}"
  local optional="${2:-1}"
  local value=""
  while true; do
    if [[ "$optional" == "1" ]]; then
      read -rp "Please enter admin email address (optional, for Let's Encrypt): " value
      if [[ -z "$value" ]]; then
        printf -v "$var_name" '%s' ""
        return 0
      fi
    else
      read -rp "Please enter admin email address: " value
    fi
    if [[ "$value" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
      printf -v "$var_name" '%s' "$value"
      return 0
    fi
    echo "Please use a valid email address (ex. info@domain.tld)."
  done
}

qadbak_install_prompt_fqdn() {
  local var_name="${1:-PANEL_HOST}"
  local default="${2:-}"
  local value=""
  read -rp "Please enter FQDN hostname [$default]: " value
  value="${value:-$default}"
  if [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    qadbak_install_warn "Do not use a bare IP as panel hostname (breaks TLS/mail). Using $default instead."
    value="$default"
  fi
  printf -v "$var_name" '%s' "$value"
}

qadbak_install_begin_logging() {
  QADBAK_INSTALL_BACKUP_ROOT="${QADBAK_INSTALL_BACKUP_ROOT:-/root/qadbak_install_backups}"
  QADBAK_INSTALL_STAMP="${QADBAK_INSTALL_STAMP:-$(date +%d%m%Y%H%M%S)}"
  QADBAK_INSTALL_BACKUP_DIR="${QADBAK_INSTALL_BACKUP_DIR:-$QADBAK_INSTALL_BACKUP_ROOT/$QADBAK_INSTALL_STAMP}"
  QADBAK_INSTALL_LOG="${QADBAK_INSTALL_LOG:-$QADBAK_INSTALL_BACKUP_ROOT/qadbak_install-$QADBAK_INSTALL_STAMP.log}"
  mkdir -p "$QADBAK_INSTALL_BACKUP_DIR" "$QADBAK_INSTALL_BACKUP_ROOT"
  echo "Installation backup directory: $QADBAK_INSTALL_BACKUP_DIR"
  echo "Installation log file: $QADBAK_INSTALL_LOG"
  echo ""
  exec > >(tee -a "$QADBAK_INSTALL_LOG") 2>&1
}

qadbak_install_packages_preamble() {
  echo ""
  echo "Adding required repositories to proceed with installation:"
  echo ""
  qadbak_install_repo_line "Node.js ${NODE_MAJOR:-20}"
  qadbak_install_repo_line "NGINX"
  qadbak_install_repo_line "Apache2"
  qadbak_install_repo_line "MariaDB"
  qadbak_install_repo_line "Qadbak Control Panel"
  echo ""
  echo "Updating currently installed packages, please wait..."
}

qadbak_install_packages_note() {
  echo ""
  qadbak_install_note "This process may take 10 to 15 minutes to complete, please wait..."
  echo ""
}

qadbak_install_congratulations() {
  local panel_url="$1"
  local admin_user="$2"
  echo ""
  qadbak_install_separator
  echo ""
  echo "Congratulations!"
  echo ""
  echo "You have successfully installed Qadbak Control Panel on your server."
  echo ""
  echo "    $panel_url"
  echo ""
  echo "    Admin username: $admin_user"
  if [[ -n "${QADBAK_INSTALL_LOG:-}" ]]; then
    echo ""
    echo "Please review the installation log at:"
    echo "    $QADBAK_INSTALL_LOG"
  fi
  echo ""
  qadbak_install_separator
}
