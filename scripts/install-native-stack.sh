#!/usr/bin/env bash
# Qadbak-first hosting stack packages. Safe on fresh Ubuntu; idempotent on upgraded servers.
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/install-native-stack.sh" >&2
  exit 1
fi

echo "==> Native stack packages (Ubuntu)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  nginx \
  apache2 \
  mariadb-server \
  mariadb-client \
  postfix \
  dovecot-core dovecot-imapd dovecot-pop3d \
  bind9 bind9utils \
  php-fpm php-cli php-mysql php-curl php-xml php-mbstring php-zip \
  certbot python3-certbot-nginx \
  ufw \
  rsync \
  unzip zip \
  awscli \
  proftpd-basic

# Keep Qadbak tooling off apt autoremove lists (backups, S3 admin, FTP tab, archives).
for pkg in mariadb-client unzip zip awscli proftpd-basic proftpd-core; do
  apt-mark manual "$pkg" 2>/dev/null || true
done

systemctl unmask proftpd 2>/dev/null || true
systemctl enable proftpd 2>/dev/null || true

systemctl enable nginx apache2 mariadb postfix dovecot bind9 2>/dev/null || true

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
