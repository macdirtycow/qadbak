#!/usr/bin/env bash
# Systemd timer: license heartbeat every 6h (fallback when Next.js scheduler misses).
set -euo pipefail

QADBAK_DIR="${QADBAK_DIR:-/opt/qadbak}"
QADBAK_USER="${QADBAK_USER:-qadbak}"
INTERVAL_HOURS="${QADBAK_HEARTBEAT_INTERVAL_HOURS:-6}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "Run as root: sudo bash scripts/configure-license-heartbeat-timer.sh" >&2
  exit 1
}

SCRIPT="$(readlink -f "$QADBAK_DIR/scripts/license-heartbeat.sh")"
[[ -f "$SCRIPT" ]] || {
  echo "Missing $SCRIPT" >&2
  exit 1
}
chmod 755 "$SCRIPT"

SERVICE="/etc/systemd/system/qadbak-license-heartbeat.service"
TIMER="/etc/systemd/system/qadbak-license-heartbeat.timer"

cat >"$SERVICE" <<EOF
[Unit]
Description=Qadbak Premium license heartbeat
After=network-online.target

[Service]
Type=oneshot
User=$QADBAK_USER
WorkingDirectory=$QADBAK_DIR
Environment=QADBAK_DIR=$QADBAK_DIR
Environment=QADBAK_USER=$QADBAK_USER
ExecStart=$SCRIPT
EOF

cat >"$TIMER" <<EOF
[Unit]
Description=Qadbak license heartbeat every ${INTERVAL_HOURS}h

[Timer]
OnBootSec=5min
OnUnitActiveSec=${INTERVAL_HOURS}h
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now qadbak-license-heartbeat.timer
systemctl start qadbak-license-heartbeat.service || true

echo "OK — timer active:"
systemctl status qadbak-license-heartbeat.timer --no-pager | head -8
echo ""
echo "Manual run: sudo -u $QADBAK_USER $SCRIPT"
