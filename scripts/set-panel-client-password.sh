#!/usr/bin/env bash
# Create or reset a panel client user in data/users.json.
# Usage:
#   sudo bash scripts/set-panel-client-password.sh USERNAME DOMAIN
#   sudo bash scripts/set-panel-client-password.sh siccamanagement siccamanagement.nl
# Prompts for password (twice). Or pass as third argument (less safe in shell history).
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
USER="${QADBAK_USER:-qadbak}"
CLIENT_USER="${1:?username}"
DOMAIN="${2:?domain}"
PASS="${3:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/set-panel-client-password.sh USER DOMAIN" >&2
  exit 1
fi

if [[ -z "$PASS" ]]; then
  read -r -s -p "New password for panel user ${CLIENT_USER}: " PASS
  echo ""
  read -r -s -p "Confirm password: " PASS2
  echo ""
  if [[ "$PASS" != "$PASS2" ]]; then
    echo "Passwords do not match." >&2
    exit 1
  fi
fi

if [[ -z "$PASS" ]]; then
  echo "Password is empty." >&2
  exit 1
fi

HASH="$(sudo -u "$USER" node "$ROOT/scripts/hash-password.mjs" "$PASS")"
USERS="$ROOT/data/users.json"
[[ -f "$USERS" ]] || { echo "Missing $USERS" >&2; exit 1; }

cp -a "$USERS" "${USERS}.bak.$(date +%Y%m%d%H%M%S)"

sudo -u "$USER" env \
  HASH="$HASH" \
  CLIENT_USER="$CLIENT_USER" \
  DOMAIN="$DOMAIN" \
  USERS="$USERS" \
  node <<'NODE'
import { readFileSync, writeFileSync } from "fs";

const usersPath = process.env.USERS;
const name = process.env.CLIENT_USER;
const domain = process.env.DOMAIN.toLowerCase();
const hash = process.env.HASH;

const users = JSON.parse(readFileSync(usersPath, "utf8"));
let u = users.find((x) => x.username === name);
if (!u) {
  u = {
    id: `client-${Date.now()}`,
    username: name,
    passwordHash: hash,
    role: "client",
    domains: [domain],
  };
  users.push(u);
  console.log(`Created client user: ${name}`);
} else {
  if (u.role !== "client") {
    console.error(`User ${name} exists but is not a client (role=${u.role}).`);
    process.exit(1);
  }
  u.passwordHash = hash;
  if (!Array.isArray(u.domains)) u.domains = [];
  if (!u.domains.some((d) => String(d).toLowerCase() === domain)) {
    u.domains.push(domain);
  }
  console.log(`Updated password for client: ${name}`);
}
writeFileSync(usersPath, `${JSON.stringify(users, null, 2)}\n`);
NODE

chown "$USER:$USER" "$USERS"
echo "OK — login at panel.${DOMAIN} with username: ${CLIENT_USER}"
