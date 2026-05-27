#!/usr/bin/env bash
# Reset panel web login password (data/users.json) — run on VPS as root.
# Usage: sudo bash scripts/reset-panel-admin-password.sh [username] [new-password]
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
USERS="$QADBAK_DIR/data/users.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/reset-panel-admin-password.sh [admin] [password]" >&2
  exit 1
fi

USER="${1:-admin}"
PASS="${2:-}"
if [[ -z "$PASS" ]]; then
  PASS="$(openssl rand -base64 12 2>/dev/null | tr -d '/+=' | head -c 14)"
  GENERATED=1
fi

if [[ ! -f "$USERS" ]]; then
  echo "Missing $USERS — run install first." >&2
  exit 1
fi

HASH="$(sudo -u "$QADBAK_USER" node "$QADBAK_DIR/scripts/hash-password.mjs" "$PASS")"
node -e "
const fs = require('fs');
const users = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const name = process.argv[2];
const hash = process.argv[3];
let found = false;
for (const u of users) {
  if (u.username === name) {
    u.passwordHash = hash;
    found = true;
    break;
  }
}
if (!found) throw new Error('User not found: ' + name);
fs.writeFileSync(process.argv[1], JSON.stringify(users, null, 2) + '\n');
" "$USERS" "$USER" "$HASH"
chown "$QADBAK_USER:$QADBAK_USER" "$USERS"
chmod 600 "$USERS"

echo "Panel login updated for user: $USER"
if [[ -n "${GENERATED:-}" ]]; then
  echo "New password: $PASS"
fi
echo "Restart panel: sudo -u $QADBAK_USER bash -c 'cd $QADBAK_DIR && pm2 restart qadbak'"
