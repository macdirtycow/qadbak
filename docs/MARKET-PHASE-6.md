# Market phase 6 — Monitoring & alerts

## Delivered

- Metrics snapshots → `data/metrics-history.jsonl` via `metrics-snapshot` helper
- UI sparkline charts on `/admin/status` (`AdminMetricsHistory`)
- Alert rules file `data/alert-rules.json` + `evaluateAlerts()` dispatcher (email / Slack / Telegram webhooks)
- API `/api/admin/alerts`, `/api/admin/metrics-history`

## Cron (recommended)

```cron
*/15 * * * * cd /opt/qadbak && node scripts/provisioning-helper.mjs metrics-snapshot
0 * * * * cd /opt/qadbak && curl -s -X POST -H "Cookie: …" https://panel.example/admin/alerts -d '{"action":"evaluate"}' 
```

Or invoke `evaluateAlerts` from a small systemd timer script on the host.

## Exit checklist

- [ ] 24h of metrics visible on status page
- [ ] Test alert fires when disk threshold exceeded

## Panel (fase 6)

| Feature | Path |
|---------|------|
| Sparklines 24h / 7d / 30d | Admin → Status → Metrics history |
| Alert rules + presets | Status → Alert rules → **Load recommended rules** |
| Manual snapshot | Record snapshot button |
| Phase progress strip | Status → 8 phases compact bar |

Recommended cron:

```cron
*/15 * * * * cd /opt/qadbak && node scripts/provisioning-helper.mjs metrics-snapshot
```
