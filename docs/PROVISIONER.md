# Provisioner abstraction (phase 2)

Qadbak talks to a **provisioner** — not directly to `virtualmin.ts` in new code.

## Configuration

```env
# Default — VirtualMin remote.cgi (current production)
QADBAK_PROVISIONER=virtualmin

# Development — still uses virtualmin adapter; mock data via VIRTUALMIN_MOCK=true
# QADBAK_PROVISIONER=mock

# Phase 8 — hybrid: native modules + VM fallback (see NATIVE-PHASES.md)
# QADBAK_PROVISIONER=hybrid
# QADBAK_NATIVE_FEATURES=ssl,dns,mail,db,domain,backup,cron
# QADBAK_VIRTUALMIN_FALLBACK=true
# QADBAK_DISABLE_WEBMIN=true

# Strict native (no remote.cgi)
# QADBAK_PROVISIONER=native
```

## Usage

```typescript
import { getProvisioner } from "@/lib/provisioner";

const p = getProvisioner();
const domains = await p.listDomains(session);
await p.createDomain(input, session);
```

Types (DNS records, SSL, etc.) may still be imported from `@/lib/provisioner` or `@/lib/virtualmin` during migration.

## Adding a new backend

1. Implement `Provisioner` in `src/lib/provisioner/<name>-adapter.ts` (same method signatures as VirtualMin module).
2. Register in `src/lib/provisioner/resolve.ts` `createProvisioner()`.
3. Set `QADBAK_PROVISIONER=<name>` in `.env.local`.

Reference: [HestiaCP](https://github.com/hestiacp/hestiacp) `v-*` CLI for a future `hestia` adapter.

## Layout

| File | Role |
|------|------|
| `types.ts` | `Provisioner`, `ProvisionerActor`, `ProvisionerId` |
| `virtualmin-adapter.ts` | Spreads `../virtualmin` into provisioner instance |
| `resolve.ts` | `getProvisioner()` singleton |
| `index.ts` | Public exports |

## Migration status

| Layer | Status |
|-------|--------|
| `src/app/api/**` | Uses `getProvisioner()` |
| `src/lib/domain-api.ts` | Uses `getProvisioner()` |
| Server components (`src/app/(app)/**`) | Uses `getProvisioner()` (phase 3) |
| UI components (types) | Import types from `@/lib/provisioner` |
| `src/lib/webmin.ts` | Break-glass Webmin links (admin only) |
