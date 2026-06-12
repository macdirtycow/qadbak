#!/usr/bin/env bash
# Post-update cleanup: stale Apache vhosts + orphan rows in native-domains.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QADBAK_DIR="${QADBAK_DIR:-$ROOT}"
REG="$QADBAK_DIR/data/native-domains.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/prune-stale-hosting.sh" >&2
  exit 1
fi

echo "==> Prune stale Apache vhosts"
bash "$ROOT/scripts/lib/prune-apache-vhosts.sh"

if [[ -f "$REG" ]] && command -v node >/dev/null 2>&1; then
  echo "==> Prune orphan native-domains.json rows (no /home/user, not demoOnly)"
  sudo -u qadbak node -e "
    const fs = require('fs');
    const path = require('path');
    const reg = process.argv[1];
    const rows = JSON.parse(fs.readFileSync(reg, 'utf8'));
    const kept = [];
    let removed = 0;
    for (const r of rows) {
      if (!r || !r.name || !r.user) continue;
      if (r.demoOnly) {
        kept.push(r);
        continue;
      }
      const home = path.join('/home', r.user);
      try {
        fs.accessSync(home);
        kept.push(r);
      } catch {
        removed++;
        console.log('    DROP registry ' + r.name + ' (no ' + home + ')');
      }
    }
    if (removed > 0) {
      fs.writeFileSync(reg, JSON.stringify(kept, null, 2) + '\\n');
      console.log('OK — removed ' + removed + ' orphan registry row(s)');
    } else {
      console.log('OK — registry clean');
    }
  " "$REG"
fi

echo "Done."
