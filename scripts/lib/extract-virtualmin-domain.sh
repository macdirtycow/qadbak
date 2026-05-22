#!/usr/bin/env bash
# Parse VirtualMin remote API JSON (multiline arrays) into a primary domain name.

extract_domain_from_vm_json() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local oneline d

  oneline="$(tr -d '\n\r' <"$file" | tr -s ' ')"

  if [[ "$oneline" =~ \"url\"[[:space:]]*:[[:space:]]*\[[[:space:]]*\"https?://([^\"/]+) ]]; then
    d="${BASH_REMATCH[1]}"
    [[ "$d" =~ \. ]] && echo "$d" && return 0
  fi
  if [[ "$oneline" =~ \"website_hostnames\"[[:space:]]*:[[:space:]]*\[[[:space:]]*\"([^\"]+)\" ]]; then
    d="${BASH_REMATCH[1]}"
    [[ "$d" =~ \. ]] && echo "$d" && return 0
  fi
  for key in name domain; do
    if [[ "$oneline" =~ \"${key}\"[[:space:]]*:[[:space:]]*\[[[:space:]]*\"([^\"]+)\" ]]; then
      d="${BASH_REMATCH[1]}"
      [[ "$d" =~ \. ]] && echo "$d" && return 0
    fi
  done
  return 1
}
