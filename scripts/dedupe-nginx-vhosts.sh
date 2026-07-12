#!/usr/bin/env bash
# Detect and (optionally) resolve duplicate server_name entries in
# /etc/nginx/sites-enabled/, which trigger
#   "conflicting server name ... on 0.0.0.0:80, ignored"
# warnings from nginx -t / reload.
#
# Usage:
#   sudo bash scripts/dedupe-nginx-vhosts.sh            # report only
#   sudo bash scripts/dedupe-nginx-vhosts.sh --apply    # disable losers
#
# Preference rules (highest wins):
#   1. Files matching $PREFERRED (env / arg)         e.g. "inveil.net.conf"
#   2. Files NOT prefixed with "qadbak-customer-"    (marketing site beats customer vhost)
#   3. Larger file size                              (more complete config)
#   4. Newer mtime
#
# Losers are backed up to /etc/nginx/sites-available/ (kept) and the
# symlink is removed from sites-enabled/.

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/dedupe-nginx-vhosts.sh [--apply]" >&2
  exit 1
fi

APPLY=0
PREFERRED="${PREFERRED:-}"
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --prefer=*) PREFERRED="${arg#*=}" ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

ENABLED_DIR="/etc/nginx/sites-enabled"
[[ -d "$ENABLED_DIR" ]] || { echo "Missing $ENABLED_DIR" >&2; exit 1; }

# Build TSV: server_name<TAB>file_path<TAB>size<TAB>mtime
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

for f in "$ENABLED_DIR"/*; do
  [[ -e "$f" ]] || continue
  real="$(readlink -f "$f")"
  [[ -f "$real" ]] || continue
  # Pull server_name tokens from any server_name directive in the file
  # (handles both block style and inline `server { server_name x; }`).
  # Strip comments first, then grep every `server_name … ;` directive.
  sed -E 's/#.*$//' "$real" \
    | tr ';' '\n' \
    | grep -oE 'server_name[[:space:]]+[^{}]+' \
    | sed -E 's/^server_name[[:space:]]+//' \
    | tr -s '[:space:]' '\n' \
    | sed '/^$/d' \
    | grep -v -E '^(_|\$)' \
    | sort -u \
    | while read -r sname; do
    size="$(wc -c <"$real")"
    mtime="$(stat -c %Y "$real" 2>/dev/null || stat -f %m "$real")"
    printf '%s\t%s\t%s\t%s\n' "$sname" "$f" "$size" "$mtime"
  done
done >"$TMP"

# Group by server_name; report and (optionally) prune duplicates.
dup_groups=0
disabled=0

mapfile -t SNAMES < <(awk -F'\t' '{print $1}' "$TMP" | sort -u)
for name in "${SNAMES[@]}"; do
  rows="$(awk -F'\t' -v n="$name" '$1 == n {print}' "$TMP")"
  count="$(printf '%s\n' "$rows" | wc -l | tr -d ' ')"
  [[ "$count" -lt 2 ]] && continue
  dup_groups=$((dup_groups + 1))

  echo "==> Duplicate server_name: $name (${count} entries)"
  printf '%s\n' "$rows" | awk -F'\t' '{ printf "    %s  (size=%s mtime=%s)\n", $2, $3, $4 }'

  # Rank
  best=""
  best_score=-1
  while IFS=$'\t' read -r _ file size mtime; do
    base="$(basename "$file")"
    score=0
    [[ -n "$PREFERRED" && "$base" == *"$PREFERRED"* ]] && score=$((score + 1000))
    [[ "$base" != qadbak-customer-* ]] && score=$((score + 100))
    score=$((score + size / 1024))
    score=$((score + mtime / 1000))
    if (( score > best_score )); then
      best_score=$score
      best="$file"
    fi
  done <<<"$rows"

  echo "    keep:    $best"

  while IFS=$'\t' read -r _ file _ _; do
    [[ "$file" == "$best" ]] && continue
    echo "    remove:  $file"
    if [[ "$APPLY" == "1" ]]; then
      if [[ -L "$file" ]]; then
        rm -f "$file"
        disabled=$((disabled + 1))
      else
        backup="${file}.dedup.$(date +%Y%m%d%H%M%S).bak"
        mv -f "$file" "$backup"
        echo "        (regular file moved to $backup)"
        disabled=$((disabled + 1))
      fi
    fi
  done <<<"$rows"
done

if [[ "$dup_groups" -eq 0 ]]; then
  echo "OK — no duplicate server_name entries found."
  exit 0
fi

echo ""
echo "Duplicate groups: $dup_groups"
if [[ "$APPLY" == "1" ]]; then
  echo "Removed entries:  $disabled"
  echo ""
  echo "==> nginx -t"
  nginx -t
  systemctl reload nginx
  echo "OK — nginx reloaded."
else
  echo "(dry run — re-run with --apply to disable the losers and reload nginx)"
fi
