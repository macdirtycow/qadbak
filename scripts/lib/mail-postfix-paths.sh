#!/usr/bin/env bash
# Shared Postfix virtual_mailbox path helpers (any domain / any VPS layout).
# Source: . "$QADBAK_DIR/scripts/lib/mail-postfix-paths.sh"

# Qadbak stores vmailbox map paths relative to virtual_mailbox_base=/ (never absolute).
qadbak_absolute_maildir_from_vmbox() {
  local vbox="${1:?vmailbox path}"
  vbox="${vbox// /}"
  vbox="${vbox%/}"
  if [[ "$vbox" == /* ]]; then
    printf '%s\n' "$vbox"
  else
    printf '/%s\n' "${vbox#/}"
  fi
}

# Parent directory of Maildir is the unix user (sub-mailbox or domain owner).
qadbak_unix_user_from_maildir() {
  local maildir
  maildir="$(qadbak_absolute_maildir_from_vmbox "${1:?maildir path}")"
  basename "$(dirname "$maildir")"
}

# Absolute paths in qadbak-vmailbox break delivery (Postfix prepends virtual_mailbox_base).
qadbak_vmbox_path_is_relative() {
  local vbox="${1// /}"
  [[ -n "$vbox" && "$vbox" != /* ]]
}

# Print WARN lines for any absolute path in qadbak-vmailbox source file.
qadbak_warn_absolute_vmbox_paths() {
  local map="${1:-/etc/postfix/qadbak-vmailbox}"
  local bad=0
  [[ -f "$map" ]] || return 0
  while IFS= read -r line; do
    line="${line%%#*}"
    [[ -n "${line// /}" ]] || continue
    local path
    path="$(awk '{print $2}' <<<"$line" | tr -d ' ')"
    [[ -n "$path" ]] || continue
    if [[ "$path" == /* ]]; then
      echo "WARN — absolute vmailbox path (re-run mail-sync): $path" >&2
      bad=1
    fi
  done <"$map"
  return "$bad"
}
