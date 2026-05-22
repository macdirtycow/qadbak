#!/usr/bin/env bash
# Open a TCP port on the VPS OS firewall (iptables / firewalld / ufw).
# Provider firewall (Contabo) must still allow the same port separately.
set -euo pipefail

PORT="${1:-}"
if [[ -z "$PORT" ]] || ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Usage: sudo bash scripts/open-host-firewall-port.sh PORT" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

echo "==> Opening TCP $PORT on host firewall"

if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp"
  echo "    ufw: allowed ${PORT}/tcp"
fi

if command -v firewall-cmd &>/dev/null && systemctl is-active firewalld &>/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${PORT}/tcp"
  firewall-cmd --reload
  echo "    firewalld: added ${PORT}/tcp"
fi

if command -v iptables &>/dev/null; then
  if ! iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 5 -p tcp --dport "$PORT" -m conntrack --ctstate NEW -j ACCEPT
    echo "    iptables: ACCEPT tcp/${PORT}"
  else
    echo "    iptables: rule already present"
  fi
  if command -v netfilter-persistent &>/dev/null; then
    DEBIAN_FRONTEND=noninteractive netfilter-persistent save 2>/dev/null || true
  elif [[ -d /etc/iptables ]]; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
  fi
fi

echo "Done. Test from your Mac: nc -zv YOUR_SERVER_IP $PORT"
