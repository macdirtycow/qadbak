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

# Figlet "standard" — letters Q A D B A K are spaced wider than the old Hestia-style banner.
qadbak_print_logo() {
  cat <<'EOF'
   ___      _    ____  ____    _    _  __
  / _ \    / \  |  _ \| __ )  / \  | |/ /
 | | | |  / _ \ | | | |  _ \ / _ \ | ' / 
 | |_| | / ___ \| |_| | |_) / ___ \| . \ 
  \__\_\/_/   \_\____/|____/_/   \_\_|\_\
EOF
}

qadbak_install_banner() {
  local version="${QADBAK_INSTALL_VERSION:-}"
  echo ""
  qadbak_install_separator
  echo ""
  qadbak_print_logo
  echo ""
  echo "  Qadbak Control Panel"
  if [[ -n "$version" ]]; then
    echo "  Version $version"
  fi
  echo "  https://qadbak.com"
  echo ""
  qadbak_install_separator
  echo ""
}

qadbak_install_panel_banner() {
  local version="${QADBAK_INSTALL_VERSION:-}"
  echo ""
  qadbak_install_separator
  echo ""
  qadbak_print_logo
  echo ""
  echo "  Qadbak Panel (UI only)"
  if [[ -n "$version" ]]; then
    echo "  Version $version"
  fi
  echo "  https://qadbak.com"
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

qadbak_install_explain_accounts() {
  local service_user="${QADBAK_USER:-qadbak}"
  cat <<EOF
Accounts on this server (who is who):

  - ${service_user}     Linux service user (runs the panel; not for web login)
  - <panel admin>       Web login you choose next (Qadbak panel UI only)
  - <hosting users>     Created later per domain in the panel (sites/mail/FTP)

Panel admin is not your SSH/SFTP account and not a hosting customer account.

EOF
}

qadbak_install_warn_default_admin() {
  local username="$1"
  [[ "$username" == "admin" ]] || return 0
  echo ""
  qadbak_install_warn 'Username "admin" is OK for demos and local tests.'
  echo "  On a public VPS, prefer a custom name (ex. panelowner) — easier to guess usernames are targeted more often."
  local confirm=""
  read -rp 'Keep "admin" as panel login? [y/N]: ' confirm
  [[ "$confirm" =~ ^[Yy]$ ]]
}

qadbak_install_prompt_username() {
  local var_name="${1:-QB_USER}"
  local default="${2:-admin}"
  local value=""
  while true; do
    read -rp "Please enter panel administrator username (web login) [$default]: " value
    value="${value:-$default}"
    if [[ ! "$value" =~ ^[a-z][a-z0-9_-]{0,31}$ ]]; then
      echo "Please use a valid username (ex. panelowner)."
      continue
    fi
    if [[ "$value" == "admin" ]] && ! qadbak_install_warn_default_admin "$value"; then
      continue
    fi
    printf -v "$var_name" '%s' "$value"
    return 0
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
  echo "    (Panel web login only — create hosting accounts later under Domains.)"
  if [[ -n "${QADBAK_INSTALL_LOG:-}" ]]; then
    echo ""
    echo "Please review the installation log at:"
    echo "    $QADBAK_INSTALL_LOG"
  fi
  echo ""
  qadbak_install_separator
}

qadbak_update_banner() {
  local version="${1:-}"
  echo ""
  qadbak_install_separator
  echo ""
  qadbak_print_logo
  echo ""
  echo "  Qadbak Update"
  if [[ -n "$version" && "$version" != "unknown" ]]; then
    echo "  Current version $version"
  fi
  echo ""
  qadbak_install_separator
  echo ""
}

qadbak_update_show_plan() {
  local mode="${1:-full}"
  local service_user="${QADBAK_USER:-qadbak}"
  cat <<EOF
This update will:

  - Sync code from git (branch from QADBAK_GIT_BRANCH or current checkout)
  - Run npm install + build as Linux user ${service_user} (never as root)
  - Restart the panel (pm2) and refresh sudo helpers

EOF
  if [[ "$mode" == "full" ]]; then
    cat <<'EOF'
  - Refresh hosting stack (nginx, Apache), backups, mail/DNS repairs
  - Run post-update checks (may take 10–20 minutes on a busy server)

Use scripts/update.sh for a quicker panel-only refresh (no stack/E2E).

EOF
  else
    cat <<'EOF'
  - Skip full hosting stack, Playwright E2E, and heavy mail/DNS repairs

EOF
  fi
  qadbak_install_note "Web login accounts are in data/users.json — not the Linux user ${service_user}."
  echo ""
}

qadbak_read_env_local_value() {
  local key="$1"
  local file="${2:-}"
  [[ -n "$file" && -f "$file" ]] || return 0
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  local val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  val="${val#\"}"; val="${val%\"}"
  val="${val#\'}"; val="${val%\'}"
  printf '%s' "$val"
}

qadbak_update_panel_urls() {
  local root="${1:-/opt/qadbak}"
  local env_file="$root/.env.local"
  local host port panel_port
  host="$(qadbak_read_env_local_value QADBAK_PUBLIC_HOST "$env_file")"
  panel_port="$(qadbak_read_env_local_value QADBAK_PANEL_PORT "$env_file")"
  panel_port="${panel_port:-11000}"
  if [[ -n "$host" ]]; then
    echo "https://${host}/login"
    echo "http://${host}:${panel_port}/login"
    return 0
  fi
  echo "http://127.0.0.1:${PORT:-3000}/login"
}

qadbak_update_summary() {
  local root="$1"
  local ver_before="$2"
  local ver_after="$3"
  local health_ok="${4:-0}"
  echo ""
  qadbak_install_separator
  echo ""
  echo "Update finished."
  echo ""
  if [[ -n "$ver_before" && -n "$ver_after" && "$ver_before" != "$ver_after" ]]; then
    echo "  Version: $ver_before → $ver_after"
  elif [[ -n "$ver_after" && "$ver_after" != "unknown" ]]; then
    echo "  Version: $ver_after"
  fi
  echo ""
  echo "  Panel login:"
  while IFS= read -r url; do
    [[ -n "$url" ]] && echo "    $url"
  done < <(qadbak_update_panel_urls "$root")
  echo ""
  if [[ "$health_ok" == "1" ]]; then
    echo "  API health: OK"
  else
    qadbak_install_warn "API health check failed — try:"
    echo "    sudo bash $root/scripts/fix-panel-now.sh"
  fi
  echo ""
  echo "  Full update:  sudo bash $root/scripts/update-qadbak.sh"
  echo "  Quick update: sudo bash $root/scripts/update.sh"
  echo ""
  qadbak_install_separator
  echo ""
}

qadbak_update_usage() {
  cat <<'EOF'
Usage: update-qadbak.sh [options]

  (no flags)   Full update — git sync, build, hosting stack, repairs, E2E
  --quick      Panel refresh only (git, build, pm2, sudo helpers)
  -y, --yes    Skip confirmation prompt
  -h, --help   Show this help

Run as root on the VPS for hosting stack and repair steps:
  sudo bash /opt/qadbak/scripts/update-qadbak.sh
EOF
}
