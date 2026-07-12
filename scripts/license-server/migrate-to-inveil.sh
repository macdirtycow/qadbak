#!/usr/bin/env bash
# Run the Inveil migration on the license VPS (wrapper for operators).
# Installs nothing locally — SSH to the license box and run migrate-to-inveil.sh there.
set -euo pipefail
cat <<'EOF'
Inveil license-server migration runs ON the license VPS as root:

  sudo bash /opt/qadbak-premium/ops/migrate-to-inveil.sh

First time on a fresh box:
  git clone git@github.com:macdirtycow/qadbak-premium.git /opt/qadbak-premium
  sudo bash /opt/qadbak-premium/ops/setup-local-license-server.sh
  sudo bash /opt/qadbak-premium/ops/migrate-to-inveil.sh

Dry run:
  sudo DRY_RUN=1 bash /opt/qadbak-premium/ops/migrate-to-inveil.sh

Docs: docs/INVEIL-MIGRATION.md (qadbak repo)
EOF
