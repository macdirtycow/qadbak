#!/usr/bin/env bash
# Run lightweight checks for market phases 1–8 on this VPS.
set -euo pipefail

ROOT="${QADBAK_DIR:-/opt/qadbak}"
cd "$ROOT"

echo "=== Qadbak market phases 1–8 ==="
fail=0

phase_ok() { echo "  [OK] $*"; }
phase_warn() { echo "  [WARN] $*" >&2; fail=1; }
phase_fail() { echo "  [FAIL] $*" >&2; fail=1; }

echo ""
echo "--- Phase 1: Native production ---"
if bash scripts/run-market-phase1-check.sh 2>/dev/null; then
  phase_ok "phase 1 gate script"
else
  phase_warn "phase 1 gate — run scripts/run-market-phase1-check.sh"
fi

echo ""
echo "--- Phase 2: App catalog ---"
if [[ -f data/app-catalog.json ]]; then
  n="$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/app-catalog.json')).filter(a=>!a.comingSoon).length)")"
  phase_ok "app-catalog.json ($n installable apps)"
else
  phase_fail "missing data/app-catalog.json"
fi
grep -q scripts .env.local 2>/dev/null && phase_ok "scripts in native features" || phase_warn "add scripts to QADBAK_NATIVE_FEATURES"

echo ""
echo "--- Phase 3: Runtimes ---"
grep -q runtimes .env.local 2>/dev/null && phase_ok "runtimes feature" || phase_warn "add runtimes to QADBAK_NATIVE_FEATURES"

echo ""
echo "--- Phase 4: Cloud offsite ---"
[[ -f data/cloud-credentials.json ]] && phase_ok "cloud credentials" || phase_warn "no data/cloud-credentials.json"
grep -qE '^QADBAK_SECRETS_KEY=.{16,}' .env.local 2>/dev/null && phase_ok "secrets key" || phase_warn "set QADBAK_SECRETS_KEY"

echo ""
echo "--- Phase 5: Granular restore ---"
phase_ok "UI: Domains → Backups → browse archive (manual verify)"

echo ""
echo "--- Phase 6: Monitoring ---"
if [[ -f data/metrics-history.jsonl ]]; then
  lines="$(wc -l < data/metrics-history.jsonl | tr -d ' ')"
  [[ "$lines" -ge 4 ]] && phase_ok "metrics history ($lines lines)" || phase_warn "few metrics snapshots — add cron metrics-snapshot"
else
  phase_warn "no data/metrics-history.jsonl"
fi
[[ -f data/alert-rules.json ]] && phase_ok "alert-rules.json" || phase_warn "configure alerts in Admin → Status"

echo ""
echo "--- Phase 7: Security ---"
grep -q security .env.local 2>/dev/null && phase_ok "security feature" || phase_warn "add security to QADBAK_NATIVE_FEATURES"
node scripts/provisioning-helper.mjs firewall-status >/dev/null 2>&1 && phase_ok "firewall helper" || phase_warn "firewall-status failed"

echo ""
echo "--- Phase 8: API ---"
if [[ -f data/api-keys.json ]]; then
  k="$(node -e "const s=JSON.parse(require('fs').readFileSync('data/api-keys.json'));console.log((s.keys||[]).length)")"
  [[ "$k" -gt 0 ]] && phase_ok "api keys ($k)" || phase_warn "no API keys yet"
else
  phase_warn "no data/api-keys.json"
fi
[[ -f docs/api/openapi.yaml ]] && phase_ok "openapi.yaml present"

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "All phase checks passed or only minor warnings."
  echo "Open Admin → 8 phases for live panel status."
  exit 0
fi
echo "Some phases need attention — see Admin → 8 phases in the panel."
exit 1
