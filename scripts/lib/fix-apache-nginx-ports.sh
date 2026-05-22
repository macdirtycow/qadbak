#!/usr/bin/env bash
# Apache must only bind 127.0.0.1:8080 — nginx owns :80 and :443.
# shellcheck shell=bash

fix_apache_listen_nginx_front() {
  local ports_conf="/etc/apache2/ports.conf"
  [[ -f "$ports_conf" ]] || return 0

  if ! grep -q 'qadbak: nginx front' "$ports_conf" 2>/dev/null || \
     grep -qE '^[[:space:]]*Listen[[:space:]]+(80|443|\[::\]:80|\[::\]:443)' "$ports_conf"; then
    cp -a "$ports_conf" "${ports_conf}.bak.qadbak.$(date +%s)"
    sed -i \
      -e 's/^\([[:space:]]*\)Listen 80$/\1#Listen 80 # qadbak: nginx front/' \
      -e 's/^\([[:space:]]*\)Listen 443$/\1#Listen 443 # qadbak: nginx front/' \
      -e 's/^\([[:space:]]*\)Listen \[::\]:80$/\1#Listen [::]:80 # qadbak: nginx front/' \
      -e 's/^\([[:space:]]*\)Listen \[::\]:443$/\1#Listen [::]:443 # qadbak: nginx front/' \
      "$ports_conf"
  fi

  if ! grep -qE '^Listen 127\.0\.0\.1:8080' "$ports_conf"; then
    echo 'Listen 127.0.0.1:8080' >>"$ports_conf"
  fi

  echo "    Apache Listen (after fix):"
  grep -E '^Listen|^#Listen|^[[:space:]]+#Listen|^[[:space:]]+Listen' "$ports_conf" | sed 's/^/      /' || true
}
