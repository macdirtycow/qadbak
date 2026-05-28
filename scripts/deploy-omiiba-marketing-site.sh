#!/usr/bin/env bash
# Sync omiiba.dev marketing site from /opt/omiiba-dev-site into public_html.
#
# Usage (panel VPS as root):
#   sudo bash scripts/deploy-omiiba-marketing-site.sh
#   sudo OMIIBA_UNIX_USER=omiiba bash scripts/deploy-omiiba-marketing-site.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="${OMIIBA_DIR:-/opt/omiiba-dev-site}"
DOMAIN="${OMIIBA_HOST:-omiiba.dev}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

if [[ ! -f "$SITE_DIR/ops/deploy-public-html.sh" ]]; then
  echo "Missing $SITE_DIR — clone first:" >&2
  echo "  git clone git@github.com:macdirtycow/omiiba-dev-site.git $SITE_DIR" >&2
  exit 1
fi

QADBAK_DIR="$ROOT" SITE_SRC="$SITE_DIR" bash "$SITE_DIR/ops/deploy-public-html.sh"
