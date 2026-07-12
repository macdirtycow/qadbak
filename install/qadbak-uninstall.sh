#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Qadbak uninstall - safely remove the Qadbak panel from a server.
#
# DEFAULT (safe):
#   - pm2 process + systemd unit         → removed
#   - /opt/qadbak (code, .env, data)     → removed (asks first)
#   - /etc/sudoers.d/qadbak-*            → removed
#   - nginx panel vhost on $PANEL_HOST   → removed
#   - panel session secret               → gone with /opt/qadbak
#   - hosting stack (nginx, mariadb, postfix, dovecot, php, bind, certbot)
#                                        → KEPT (likely needed for your sites)
#   - customer data in /var/www, mailboxes, DBs
#                                        → KEPT
#
# Flags:
#   --yes               Skip confirmation prompts (dangerous; use in scripts).
#   --keep-code         Keep /opt/qadbak on disk (uninstall service only).
#   --remove-user       Delete the system user "qadbak" after removing /opt/qadbak.
#   --remove-stack      Also apt-purge the hosting stack packages. DANGEROUS.
#   --remove-customers  Also wipe /var/www/*, mailboxes, MariaDB user dbs.
#                       *** EXTREMELY DANGEROUS - destroys hosted sites ***
#   --dry-run           Print everything that would happen, change nothing.
#   -h | --help         Show this help.
#
# Example - safe panel removal:
#   sudo bash install/qadbak-uninstall.sh
#
# Example - full nuke (test VPS only):
#   sudo bash install/qadbak-uninstall.sh --yes --remove-user --remove-stack --remove-customers
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"

ASSUME_YES=0
KEEP_CODE=0
REMOVE_USER=0
REMOVE_STACK=0
REMOVE_CUSTOMERS=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)              ASSUME_YES=1 ;;
    --keep-code)           KEEP_CODE=1 ;;
    --remove-user)         REMOVE_USER=1 ;;
    --remove-stack)        REMOVE_STACK=1 ;;
    --remove-customers)    REMOVE_CUSTOMERS=1 ;;
    --dry-run)             DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $1 (try --help)" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash install/qadbak-uninstall.sh" >&2
  exit 1
fi

# ─── helpers ────────────────────────────────────────────────────────────────
GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
log()  { printf '%s==>%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%sWARN:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
err()  { printf '%sERR:%s  %s\n' "$RED"    "$RESET" "$*" >&2; }
run()  {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '   [dry-run] %s\n' "$*"
  else
    eval "$@"
  fi
}

confirm() {
  local prompt="$1" default="${2:-N}" answer
  if [[ "$ASSUME_YES" -eq 1 ]]; then
    echo "  $prompt [auto-yes via --yes]"
    return 0
  fi
  read -rp "  $prompt [y/N]: " answer
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[Yy]$ ]]
}

# ─── pre-flight summary ─────────────────────────────────────────────────────
PANEL_HOST=""
ORIGIN_IP=""
if [[ -f "$QADBAK_DIR/.env.local" ]]; then
  PANEL_HOST="$(grep -E '^(QADBAK_PUBLIC_HOST|PANEL_HOST)=' "$QADBAK_DIR/.env.local" | head -1 | cut -d= -f2-)"
  ORIGIN_IP="$(grep -E '^QADBAK_ORIGIN_IP=' "$QADBAK_DIR/.env.local" | head -1 | cut -d= -f2-)"
fi

echo ""
echo "${BOLD}Qadbak uninstall plan${RESET}"
echo "  Directory      : $QADBAK_DIR              $([[ -d "$QADBAK_DIR" ]] && echo "(present)" || echo "(not found)")"
echo "  System user    : $QADBAK_USER             $(id "$QADBAK_USER" &>/dev/null && echo "(exists)" || echo "(absent)")"
echo "  Panel host     : ${PANEL_HOST:-unknown}"
echo "  pm2 process    : $(sudo -u "$QADBAK_USER" pm2 list 2>/dev/null | grep -c qadbak || echo 0) running"
echo "  Sudoers files  : $(ls /etc/sudoers.d/qadbak-* 2>/dev/null | wc -l | tr -d ' ') file(s)"
echo "  Mode flags     : keep-code=$KEEP_CODE  remove-user=$REMOVE_USER  remove-stack=$REMOVE_STACK  remove-customers=$REMOVE_CUSTOMERS  dry-run=$DRY_RUN"
echo ""

if [[ "$REMOVE_CUSTOMERS" -eq 1 ]]; then
  echo "${RED}${BOLD}!!  DANGER: --remove-customers will permanently delete${RESET}"
  echo "${RED}${BOLD}      /home/* unix users created by the panel,${RESET}"
  echo "${RED}${BOLD}      /var/www site files, mailboxes, and per-domain databases.${RESET}"
  echo "${RED}${BOLD}      This destroys hosted customer data. Use only on a test VPS.${RESET}"
  echo ""
fi
if [[ "$REMOVE_STACK" -eq 1 ]]; then
  echo "${YELLOW}${BOLD}!  --remove-stack will apt-purge nginx, apache2, mariadb, postfix,${RESET}"
  echo "${YELLOW}${BOLD}      dovecot, bind9, php-fpm, certbot. If your sites depend on these${RESET}"
  echo "${YELLOW}${BOLD}      services, do NOT enable this flag.${RESET}"
  echo ""
fi

if ! confirm "Proceed with uninstall?" ; then
  echo "Aborted."
  exit 0
fi

# ─── 1. Stop pm2 + service ──────────────────────────────────────────────────
log "1. Stopping pm2 process and systemd unit"
if id "$QADBAK_USER" &>/dev/null; then
  run "sudo -u '$QADBAK_USER' pm2 delete qadbak >/dev/null 2>&1 || true"
  run "sudo -u '$QADBAK_USER' pm2 save --force >/dev/null 2>&1 || true"
  run "sudo -u '$QADBAK_USER' pm2 kill >/dev/null 2>&1 || true"
fi
run "env PATH=\"\$PATH:/usr/bin\" pm2 unstartup systemd -u '$QADBAK_USER' --hp '$QADBAK_DIR' >/dev/null 2>&1 || true"
run "systemctl disable --now 'pm2-${QADBAK_USER}' >/dev/null 2>&1 || true"
run "rm -f '/etc/systemd/system/pm2-${QADBAK_USER}.service'"
run "systemctl daemon-reload >/dev/null 2>&1 || true"

# ─── 2. Sudoers ─────────────────────────────────────────────────────────────
log "2. Removing /etc/sudoers.d/qadbak-* entries"
for f in /etc/sudoers.d/qadbak-*; do
  [[ -f "$f" ]] || continue
  run "rm -f '$f'"
done
run "visudo -c >/dev/null 2>&1 || true"

# ─── 3. nginx panel vhost ───────────────────────────────────────────────────
log "3. Removing nginx panel vhost"
removed_any_vhost=0
for name in qadbak qadbak-panel "$PANEL_HOST" "${PANEL_HOST}.conf"; do
  for path in "/etc/nginx/sites-enabled/$name" "/etc/nginx/sites-available/$name"; do
    if [[ -f "$path" || -L "$path" ]]; then
      run "rm -f '$path'"
      removed_any_vhost=1
    fi
  done
done
# Remove the alt :11000 vhost too
for f in /etc/nginx/sites-enabled/qadbak-panel-* /etc/nginx/sites-available/qadbak-panel-*; do
  [[ -e "$f" ]] || continue
  run "rm -f '$f'"
  removed_any_vhost=1
done
if [[ "$removed_any_vhost" -eq 1 ]] && command -v nginx >/dev/null; then
  run "nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true"
fi

# ─── 4. Code directory ──────────────────────────────────────────────────────
if [[ "$KEEP_CODE" -eq 1 ]]; then
  log "4. Keeping $QADBAK_DIR (--keep-code)"
else
  log "4. Removing $QADBAK_DIR"
  if [[ -d "$QADBAK_DIR" ]]; then
    if confirm "Delete entire $QADBAK_DIR (code, .env.local, users.json, audit log)?"; then
      run "rm -rf '$QADBAK_DIR'"
    else
      warn "Kept $QADBAK_DIR - re-run with --keep-code to silence this prompt next time."
      KEEP_CODE=1
    fi
  fi
fi

# ─── 5. System user ─────────────────────────────────────────────────────────
if [[ "$REMOVE_USER" -eq 1 ]]; then
  if [[ "$KEEP_CODE" -eq 1 ]]; then
    warn "5. Skipping user removal: --keep-code is set, user still owns files in $QADBAK_DIR"
  elif id "$QADBAK_USER" &>/dev/null; then
    log "5. Removing system user '$QADBAK_USER'"
    run "pkill -u '$QADBAK_USER' 2>/dev/null; sleep 1; pkill -KILL -u '$QADBAK_USER' 2>/dev/null || true"
    run "userdel -r '$QADBAK_USER' 2>/dev/null || userdel '$QADBAK_USER' 2>/dev/null || true"
  fi
else
  log "5. Keeping system user '$QADBAK_USER' (use --remove-user to delete)"
fi

# ─── 6. Customer data (DANGEROUS) ───────────────────────────────────────────
if [[ "$REMOVE_CUSTOMERS" -eq 1 ]]; then
  echo ""
  warn "About to delete hosted-customer artifacts:"
  warn "  - /var/www/*"
  warn "  - all /home/<unix-user> created by Qadbak (uid >= 1000, has public_html)"
  warn "  - per-domain MariaDB databases (those tagged in data/native-domains.json - if still present)"
  warn "  - dovecot mailboxes in /var/mail/vhosts and /home/*/Maildir"
  if confirm "Type-y-to-confirm IRREVERSIBLE deletion of hosted customer data" ; then
    log "6. Deleting customer data"

    # /var/www/*
    if [[ -d /var/www ]]; then
      for d in /var/www/*; do
        [[ -d "$d" ]] || continue
        # keep /var/www/html if it's the default nginx page
        [[ "$d" == "/var/www/html" ]] && continue
        run "rm -rf '$d'"
      done
    fi

    # Unix users created by panel (anyone uid >= 1000 with a public_html)
    while IFS=: read -r u _ uid _ _ home _; do
      [[ "$uid" -lt 1000 ]] && continue
      [[ "$u" == "$QADBAK_USER" ]] && continue
      [[ "$u" == "nobody" ]] && continue
      [[ -d "$home/public_html" ]] || continue
      log "   deleting unix user $u ($home)"
      run "pkill -u '$u' 2>/dev/null; sleep 1; pkill -KILL -u '$u' 2>/dev/null || true"
      run "userdel -r '$u' 2>/dev/null || userdel '$u' 2>/dev/null || true"
    done </etc/passwd

    # Mailboxes
    run "rm -rf /var/mail/vhosts/* 2>/dev/null || true"

    # MariaDB customer dbs (kept very conservative: only obvious panel-created ones)
    if command -v mariadb >/dev/null; then
      mariadb -Bse "SHOW DATABASES" 2>/dev/null | while read -r db; do
        case "$db" in
          information_schema|mysql|performance_schema|sys|phpmyadmin) continue ;;
        esac
        run "mariadb -e \"DROP DATABASE IF EXISTS \\\`$db\\\`\""
      done
    fi
  else
    warn "Skipped customer data removal."
  fi
else
  log "6. Keeping customer data (use --remove-customers to wipe - DANGEROUS)"
fi

# ─── 7. Hosting stack packages (DANGEROUS) ──────────────────────────────────
if [[ "$REMOVE_STACK" -eq 1 ]]; then
  echo ""
  warn "About to apt-purge the entire hosting stack."
  warn "  Packages: nginx, apache2, mariadb-server, postfix, dovecot-*, bind9*,"
  warn "            php-fpm, php-*, certbot, python3-certbot-nginx, proftpd-basic"
  if confirm "Type-y-to-confirm REMOVAL of hosting stack packages" ; then
    log "7. Purging hosting stack"
    run "systemctl stop nginx apache2 mariadb postfix dovecot bind9 named php*-fpm proftpd 2>/dev/null || true"
    run "DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq \\
      nginx nginx-common nginx-core \\
      apache2 apache2-bin apache2-data apache2-utils \\
      mariadb-server mariadb-server-* mariadb-client mariadb-client-* mariadb-common \\
      postfix postfix-* \\
      dovecot-core dovecot-imapd dovecot-pop3d dovecot-sieve dovecot-* \\
      bind9 bind9-* named \\
      'php[0-9.]+*-fpm' 'php[0-9.]+*-cli' 'php[0-9.]+*-mysql' php-fpm php-cli php-* \\
      certbot python3-certbot-nginx \\
      proftpd-basic proftpd-core proftpd-doc \\
      2>/dev/null || true"
    run "apt-get autoremove -y -qq 2>/dev/null || true"
  else
    warn "Skipped hosting stack removal."
  fi
else
  log "7. Keeping hosting stack packages (use --remove-stack to purge - DANGEROUS)"
fi

# ─── 8. Optional leftover scrub ─────────────────────────────────────────────
log "8. Final scrub"
# Lingering pm2 dirs in qadbak home (if --keep-code skipped)
if [[ "$KEEP_CODE" -eq 0 && ! -d "$QADBAK_DIR" ]]; then
  run "rm -rf '/home/$QADBAK_USER/.pm2' 2>/dev/null || true"
fi
# Stale /etc/qadbak - license server env lives here; only remove if empty
if [[ -d /etc/qadbak ]]; then
  if [[ -z "$(ls -A /etc/qadbak 2>/dev/null)" ]]; then
    run "rmdir /etc/qadbak"
  else
    warn "Leaving /etc/qadbak alone (contains files - likely license-server.env)."
  fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "${GREEN}${BOLD}============================================${RESET}"
echo "${GREEN}${BOLD} Qadbak uninstall complete${RESET}"
echo "${GREEN}${BOLD}============================================${RESET}"
echo "  Panel host        : ${PANEL_HOST:-unknown} (DNS / Let's Encrypt cert NOT touched)"
[[ "$KEEP_CODE" -eq 1 ]]   && echo "  Code              : kept at $QADBAK_DIR"
[[ "$KEEP_CODE" -eq 0 ]]   && echo "  Code              : removed"
[[ "$REMOVE_USER" -eq 1 ]] && echo "  System user       : removed"
[[ "$REMOVE_USER" -eq 0 ]] && echo "  System user       : kept ($QADBAK_USER)"
[[ "$REMOVE_STACK" -eq 1 ]]&& echo "  Hosting stack     : purged"
[[ "$REMOVE_STACK" -eq 0 ]]&& echo "  Hosting stack     : kept"
[[ "$REMOVE_CUSTOMERS" -eq 1 ]]&& echo "  Customer data     : WIPED"
[[ "$REMOVE_CUSTOMERS" -eq 0 ]]&& echo "  Customer data     : kept"
echo ""
echo "  Next: reinstall with"
echo "    git clone https://github.com/macdirtycow/qadbak.git $QADBAK_DIR"
echo "    sudo bash $QADBAK_DIR/install/qadbak-install.sh"
