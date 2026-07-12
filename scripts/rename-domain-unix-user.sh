#!/usr/bin/env bash
# Rename a Qadbak domain unix user (e.g. omiiba → inveil for inveil.net).
#
# Usage:
#   sudo bash scripts/rename-domain-unix-user.sh OLD_USER NEW_USER [DOMAIN]
#   sudo bash scripts/rename-domain-unix-user.sh omiiba inveil inveil.net
#
# Updates: /home, native-domains.json, nginx, PHP-FPM pools, Postfix maps,
# optional MariaDB user/db prefixes, then re-applies vhost + mail sync.
set -euo pipefail

OLD_USER="${1:?old unix user (e.g. omiiba)}"
NEW_USER="${2:?new unix user (e.g. inveil)}"
DOMAIN="${3:-inveil.net}"
QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
REG="$QADBAK_DIR/data/native-domains.json"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash $0 $OLD_USER $NEW_USER [$DOMAIN]" >&2
  exit 1
}

if [[ "$OLD_USER" == "$NEW_USER" ]]; then
  echo "OLD_USER and NEW_USER are the same — nothing to do." >&2
  exit 0
fi

if ! id "$OLD_USER" &>/dev/null; then
  echo "ERROR: unix user '$OLD_USER' does not exist." >&2
  exit 1
fi

if id "$NEW_USER" &>/dev/null; then
  echo "ERROR: target user '$NEW_USER' already exists — pick another name or remove it first." >&2
  exit 1
fi

log() { echo "==> $*"; }

log "Rename unix user '$OLD_USER' → '$NEW_USER' (domain: $DOMAIN)"

OLD_HOME="/home/${OLD_USER}"
NEW_HOME="/home/${NEW_USER}"

if getent group "$OLD_USER" >/dev/null 2>&1; then
  log "Rename group $OLD_USER → $NEW_USER"
  groupmod -n "$NEW_USER" "$OLD_USER"
fi

log "usermod -l $NEW_USER -d $NEW_HOME -m $OLD_USER"
usermod -l "$NEW_USER" -d "$NEW_HOME" -m "$OLD_USER"

if [[ -f "$OLD_HOME/.qadbak-domain" ]]; then
  echo "$DOMAIN" >"$NEW_HOME/.qadbak-domain"
  chown "${NEW_USER}:${NEW_USER}" "$NEW_HOME/.qadbak-domain"
fi

chown -R "${NEW_USER}:${NEW_USER}" "$NEW_HOME"

log "Update $REG"
if [[ -f "$REG" ]]; then
  if command -v jq &>/dev/null; then
    tmp="$(mktemp)"
    jq --arg d "$DOMAIN" --arg nu "$NEW_USER" '
      map(if (.name | ascii_downcase) == ($d | ascii_downcase) then . + {user: $nu} else . end)
    ' "$REG" >"$tmp"
    mv "$tmp" "$REG"
  else
    node - "$REG" "$DOMAIN" "$NEW_USER" <<'NODE'
const fs = require("fs");
const [file, domain, user] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(file, "utf8"));
let n = 0;
for (const r of rows) {
  if (String(r.name || "").toLowerCase() === domain.toLowerCase()) {
    r.user = user;
    n++;
  }
}
fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
if (!n) process.stderr.write(`WARN: domain ${domain} not found in registry\n`);
NODE
  fi
  chown "$QADBAK_USER:$QADBAK_USER" "$REG" 2>/dev/null || true
else
  log "Registry missing — run export-native-domains.sh after rename"
  bash "$QADBAK_DIR/scripts/export-native-domains.sh" 2>/dev/null || true
fi

log "Patch nginx configs (/home/${OLD_USER} → /home/${NEW_USER})"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  sed -i "s|/home/${OLD_USER}|/home/${NEW_USER}|g" "$f"
  sed -i "s|qadbak-${OLD_USER}\\.sock|qadbak-${NEW_USER}.sock|g" "$f"
done < <(grep -rlE "/home/${OLD_USER}|qadbak-${OLD_USER}" /etc/nginx 2>/dev/null || true)

log "Remove old PHP-FPM pools (qadbak-${OLD_USER})"
for pool_dir in /etc/php/*/fpm/pool.d; do
  [[ -d "$pool_dir" ]] || continue
  rm -f "${pool_dir}/qadbak-${OLD_USER}.conf"
done

if [[ -x "$QADBAK_DIR/scripts/apply-php-fpm-pool.sh" ]]; then
  ver=""
  cfg="$QADBAK_DIR/data/domain-config/${DOMAIN}/php.json"
  if [[ -f "$cfg" ]] && command -v jq &>/dev/null; then
    ver="$(jq -r '.defaultVersion // empty' "$cfg" 2>/dev/null | head -1)"
  fi
  log "Apply PHP-FPM pool for $NEW_USER"
  bash "$QADBAK_DIR/scripts/apply-php-fpm-pool.sh" "$NEW_USER" "${ver:-}" "$NEW_HOME" || true
fi

log "Best-effort MariaDB user prefix rename (${OLD_USER}_ → ${NEW_USER}_) "
if command -v mysql &>/dev/null; then
  mapfile -t mysql_users < <(
    mysql -N -B -e "SELECT user FROM mysql.user WHERE user LIKE '${OLD_USER}\\_%'" 2>/dev/null || true
  )
  for u in "${mysql_users[@]:-}"; do
    [[ -z "$u" ]] && continue
    nu="${u/${OLD_USER}_/${NEW_USER}_}"
    log "  RENAME USER \`$u\`@localhost → \`$nu\`@localhost"
    mysql -e "RENAME USER \`${u}\`@\`localhost\` TO \`${nu}\`@\`localhost\`;" 2>/dev/null || \
      echo "    WARN: could not rename MySQL user $u" >&2
  done

  mapfile -t mysql_dbs < <(
    mysql -N -B -e "SHOW DATABASES LIKE '${OLD_USER}\\_%'" 2>/dev/null || true
  )
  for db in "${mysql_dbs[@]:-}"; do
    [[ -z "$db" ]] && continue
    ndb="${db/${OLD_USER}_/${NEW_USER}_}"
    tables="$(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${db}'" 2>/dev/null || echo 0)"
    if [[ "${tables:-0}" == "0" ]]; then
      log "  Drop empty database \`$db\` (create \`$ndb\` on next db-create if needed)"
      mysql -e "DROP DATABASE IF EXISTS \`${db}\`;" 2>/dev/null || true
    else
      echo "    WARN: database $db has ${tables} table(s) — rename manually (mysqldump → $ndb) if needed" >&2
    fi
  done
fi

log "Re-apply nginx vhost for $DOMAIN"
if [[ -x "$QADBAK_DIR/scripts/apply-domain-nginx.sh" ]]; then
  bash "$QADBAK_DIR/scripts/apply-domain-nginx.sh" "$DOMAIN" "$NEW_USER" || true
fi

log "Mail sync (Postfix maps + Dovecot)"
if id "$QADBAK_USER" &>/dev/null && [[ -x "$QADBAK_DIR/scripts/run-provisioning-helper.sh" ]]; then
  sudo -u "$QADBAK_USER" sudo -n "$QADBAK_DIR/scripts/run-provisioning-helper.sh" mail-sync 2>/dev/null || \
    bash "$QADBAK_DIR/scripts/configure-native-mail.sh" --force 2>/dev/null || true
fi

if command -v systemctl &>/dev/null; then
  systemctl reload php*-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || true
  nginx -t && systemctl reload nginx
fi

if command -v pm2 &>/dev/null && pm2 describe qadbak &>/dev/null; then
  pm2 restart qadbak >/dev/null 2>&1 || true
fi

cat <<EOF

Done — unix user renamed: ${OLD_USER} → ${NEW_USER}
  home:     ${NEW_HOME}
  domain:   ${DOMAIN}
  registry: ${REG}

Verify:
  id ${NEW_USER}
  ls -la ${NEW_HOME}
  grep '"name".*${DOMAIN}' ${REG}
  sudo bash ${QADBAK_DIR}/scripts/repair-panel-webmail.sh ${DOMAIN} info

EOF
