#!/usr/bin/env bash
# Qadbak-first hosting stack packages. Safe on fresh Ubuntu/Debian; idempotent on upgraded servers.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
# shellcheck source=lib/linux-distro.sh
source "$(dirname "$0")/lib/linux-distro.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/install-native-stack.sh" >&2
  exit 1
fi

qadbak_detect_linux_distro || {
  echo "Qadbak native stack requires Ubuntu 22.04/24.04/26.04 LTS or Debian 12." >&2
  exit 1
}

BIND_PKGS="$(qadbak_bind_apt_packages)"
PHP_EXTRA="$(qadbak_php_extra_apt_packages)"

echo "==> Native stack packages ($(qadbak_linux_release_label))"
qadbak_pkg_update
# shellcheck disable=SC2086
qadbak_pkg_install \
  nginx \
  apache2 \
  mariadb-server \
  mariadb-client \
  postfix \
  dovecot-core dovecot-imapd dovecot-pop3d dovecot-sieve \
  $BIND_PKGS \
  php-fpm php-cli php-mysql php-curl php-xml php-mbstring php-zip \
  $PHP_EXTRA \
  certbot python3-certbot-nginx \
  ufw \
  fail2ban \
  rsync \
  unzip zip \
  proftpd-basic \
  jq

# Keep Qadbak tooling off apt autoremove lists (backups, S3 admin, FTP tab, archives).
for pkg in mariadb-client unzip zip proftpd-basic proftpd-core; do
  apt-mark manual "$pkg" 2>/dev/null || true
done

echo "==> AWS CLI (optional — S3 admin)"
qadbak_install_aws_cli

systemctl unmask proftpd 2>/dev/null || true
systemctl enable proftpd 2>/dev/null || true

systemctl enable nginx apache2 mariadb postfix dovecot bind9 2>/dev/null || true

# fail2ban: brute-force protection on SSH + the panel — drop into a
# separate helper so existing installs can pick it up via vps-after-pull.sh
# without re-running the full native-stack install.
bash "$QADBAK_DIR/scripts/ensure-fail2ban.sh"

if [[ -f "$QADBAK_DIR/scripts/configure-bind-native.sh" ]]; then
  echo "==> BIND9 (native DNS zones)"
  bash "$QADBAK_DIR/scripts/configure-bind-native.sh"
fi

if [[ -f "$QADBAK_DIR/scripts/configure-native-mail.sh" ]]; then
  echo "==> Postfix + Dovecot (native mail)"
  bash "$QADBAK_DIR/scripts/configure-native-mail.sh" || echo "WARN: configure-native-mail.sh failed" >&2
fi

echo "==> Apache backend (nginx front on :80/:443)"
if [[ -f "$QADBAK_DIR/scripts/ensure-apache-backend.sh" ]]; then
  bash "$QADBAK_DIR/scripts/ensure-apache-backend.sh"
else
  echo "WARN: ensure-apache-backend.sh missing — git pull" >&2
fi

echo "OK — native stack packages installed"
echo "    Apache: 127.0.0.1:8080 behind nginx (php-fpm)"
