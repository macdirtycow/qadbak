#!/usr/bin/env bash
# Shared helpers — no hardcoded customer domain names.

_is_valid_domain() {
  [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]
}

_virtualmin_list_domains() {
  if ! command -v virtualmin &>/dev/null; then
    return 1
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    virtualmin list-domains --name-only 2>/dev/null
    return $?
  fi
  if sudo -n virtualmin list-domains --name-only 2>/dev/null; then
    return 0
  fi
  virtualmin list-domains --name-only 2>/dev/null
}

first_virtualmin_domain() {
  local d
  while read -r d; do
    [[ -z "$d" ]] && continue
    _is_valid_domain "$d" || continue
    echo "$d"
    return 0
  done < <(_virtualmin_list_domains | sed '/^$/d')
  return 1
}

# First domain for nginx probes: native registry, then legacy CLI.
first_panel_domain() {
  local reg="${QADBAK_DIR:-/opt/qadbak}/data/native-domains.json"
  local d
  if [[ -f "$reg" ]]; then
    d="$(grep -o '"name":"[^"]*"' "$reg" 2>/dev/null | head -1 | sed 's/"name":"//;s/"//')"
    if _is_valid_domain "$d"; then
      echo "$d"
      return 0
    fi
  fi
  first_virtualmin_domain
}
