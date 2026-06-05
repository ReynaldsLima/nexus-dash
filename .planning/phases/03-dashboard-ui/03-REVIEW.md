---
phase: 03-dashboard-ui
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - app/[tenant-slug]/campanhas/page.tsx
  - app/[tenant-slug]/dashboard/page.tsx
  - app/[tenant-slug]/settings/page.tsx
  - app/api/meta-ads/connect/route.ts
  - app/providers.tsx
  - components/campanhas/campaign-sheet.tsx
  - components/dashboard/date-range-picker.tsx
  - components/layout/header-actions.tsx
  - components/settings/meta-ads-form.tsx
  - components/ui/calendar.tsx
  - components/ui/popover.tsx
  - components/ui/sheet.tsx
  - lib/campaign-aggregation.ts
  - lib/dashboard-kpis.ts
  - lib/formatters.ts
  - lib/hooks/use-campaigns-data.ts
  - lib/hooks/use-dashboard-data.ts
  - lib/stores/date-range.ts
  - supabase/migrations/0013_create_vault_write_function.sql
  - tests/unit/campaign-aggregation.test.ts
  - tests/unit/channel-split.test.ts
  - tests/unit/dashboard-kpis.test.ts
  - tests/unit/date-range-store.test.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 3 delivers a multi-tenant analytics dashboard (KPI cards, area/pie charts, campaign table, campaign drill-down sheet, settings/Meta Ads token flow, date-range store). The overall architecture is sound: RLS enforces tenant isolation, the Meta Ads token goes through Vault via a service-role RPC, the route handler validates input with Zod, and the math library (`dashboard-kpis.ts`, `campaign-aggregation.ts`) is clean and well-tested.

Two critical issues require fixes before this phase ships:

1. **The route handler does not verify that the caller has permission for the `tenantId` they supply.** A `tenant_admin` can pass any UUID as `tenantId` and store a Vault secret under an arbitrary tenant.
2. **The Vault SQL function is `SECURITY DEFINER` with `SET search_path = public, vault` and grants `EXECUTE` to `authenticator`.** In Supabase the `authenticator` role is the PostgREST gateway role — granting it execute access to a `SECURITY DEFINER` function that touches the Vault means any authenticated browser request can call the function directly via the PostgREST RPC endpoint, bypassing the Route Handler's authorization checks entirely.

---

## Critical Issues

### CR-01: Route handler does not verify caller owns the supplied `tenantId`

**File:** `app/api/meta-ads/connect/route.ts:71`

**Issue:** After validating the Zod schema the handler uses `parsed.data.tenantId` directly. It confirms the user is `super_admin` or `tenant_admin` (step 2) but never checks whether a `tenant_admin` caller is allowed to write to the specific `tenantId` they submitted. A `tenant_admin` of tenant A can POST `{ tenantId: "<tenant_B_uuid>", ... }` and successfully write a Vault secret and `ad_accounts` row for tenant B. The Vault RPC and the `ad_accounts` upsert both run under `service_role`, so RLS does not protect against this.

**Fix:** After the role check, resolve the caller's own `tenant_id` from the JWT claims or from a Supabase RPC, and assert it matches the request body when the caller is not `super_admin`:

```typescript
// After role check (step 2), before parsing body (step 3)
if (role !== 'super_admin') {
  // get_user_tenant_id() returns the tenant_id from the JWT app_metadata
  const { data: callerTenantId, error: tidErr } = await supabase.rpc('get_user_tenant_id')
  if (tidErr || !callerTenantId) {
    return NextResponse.json({ error: 'Não foi possível verificar o tenant do usuário' }, { status: 403 })
  }
  // tenantId from body not yet parsed — parse first, then compare
  // (move Zod parse above this check, or do a quick UUID check here)
  if (callerTenantId !== parsed.data.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

Alternatively, ignore `tenantId` from the body entirely for `tenant_admin` callers and derive it server-side from the JWT — this is the safer pattern.

---

### CR-02: `GRANT EXECUTE ON ... TO authenticator` exposes `SECURITY DEFINER` Vault function to the PostgREST RPC endpoint

**File:** `supabase/migrations/0013_create_vault_write_function.sql:53`

**Issue:** The comment in migration 0013 says `authenticator` is granted because PostgREST requires it for the intermediary role. However, `authenticator` in Supabase's PostgREST stack is the role that handles incoming HTTP requests and then switches to `anon` or `authenticated`. Granting `EXECUTE` on a `SECURITY DEFINER` function to `authenticator` means that any browser client with a valid JWT can call `select public.create_or_update_vault_secret(...)` directly through the Supabase Data API (`POST /rest/v1/rpc/create_or_update_vault_secret`). The Route Handler's role check and Zod validation are completely bypassed. The `REVOKE` on `authenticated` is insufficient because PostgREST executes the function as `authenticator` (not as `authenticated`) when the function uses `SECURITY DEFINER`.

The correct Supabase pattern for "callable only from service-role, never from browser" is:
- Grant only to `service_role`.
- Do NOT grant to `authenticator`.
- The Route Handler calls the function via the service role client; PostgREST never gets to invoke it.

```sql
-- Remove the authenticator grant
REVOKE EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, authenticator;
GRANT EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) TO service_role;
```

The existing `read_vault_secret` function (migration 0010) should be reviewed under the same logic. If it also grants `authenticator`, it is similarly reachable from the browser.

---

## Warnings

### WR-01: `app/[tenant-slug]/layout.tsx` uses `getSession()` for authorization — session can be spoofed

**File:** `app/[tenant-slug]/layout.tsx:47`

**Issue:** The layout reads `role` and `tenant_slug` from the raw JWT via `getSession()` and a manual `decodeClaims()` base64 decode. `getSession()` does not revalidate the JWT against Supabase Auth — it returns whatever is stored in the cookie without a server round-trip. An attacker who can forge or replay a cookie can inject arbitrary `app_metadata` claims. The safe pattern in Supabase SSR is to use `getUser()` (which the layout already calls for the redirect guard) and then read claims from `user.app_metadata`, which is populated by the server-verified token.

**Fix:**
```typescript
// Replace:
const { data: { session } } = await supabase.auth.getSession()
const claims = decodeClaims(session?.access_token)
const role = claims?.role ?? null
const tokenSlug = claims?.tenant_slug ?? null

// With (user is already fetched above for the redirect guard):
const role = (user.app_metadata?.role as string | null) ?? null
const tokenSlug = (user.app_metadata?.tenant_slug as string | null) ?? null
```

This eliminates the `decodeClaims` helper, the `getSession()` call, and the manual JWT decode entirely.

---

### WR-02: `campaign-aggregation.ts` maps only `'ENABLED'` to `active` — Meta Ads active status is silently mapped to `paused`

**File:** `lib/campaign-aggregation.ts:82`

**Issue:** Google Ads uses the `ENABLED` string for active campaigns. Meta Ads uses `ACTIVE`. The current mapping:

```typescript
status: agg.latestStatus === 'ENABLED' ? 'active' : 'paused',
```

will classify every active Meta Ads campaign as `paused` in the UI. This is a display logic bug that causes misleading status indicators for all Meta Ads campaigns. The test at `campaign-aggregation.test.ts:105` only exercises `ENABLED` and `PAUSED`, missing the Meta Ads case entirely.

**Fix:**
```typescript
status: (agg.latestStatus === 'ENABLED' || agg.latestStatus === 'ACTIVE') ? 'active' : 'paused',
```

Add a test case:
```typescript
it('status ACTIVE (Meta Ads) → active', () => {
  const result = groupCampaignMetrics([makeRow({ status: 'ACTIVE', channel: 'meta_ads' })])
  expect(result[0].status).toBe('active')
})
```

---

### WR-03: `computePriorRange` uses a fixed 86400000ms offset, which breaks across DST boundaries

**File:** `lib/dashboard-kpis.ts:51`

**Issue:** The prior-period boundary is computed as:

```typescript
const priorTo = new Date(from.getTime() - 86400000) // dia antes do período atual
```

Subtracting exactly 86,400,000 ms (one day) from a timestamp that sits at midnight on a DST transition date produces a time of 23:00 or 01:00 the previous day, not midnight. When that `priorTo` value is converted to a date string via `toISOString().split('T')[0]`, the resulting date can be off by one day in affected timezones. Given that NEXUS-DASH currently serves Brazilian clients (UTC-3), which observe DST, this will produce a wrong prior period boundary on two days per year, causing the prior period to be one day shorter or longer than expected.

**Fix:** Use a date-arithmetic approach that is DST-safe:
```typescript
export function computePriorRange(from: Date, to: Date): { priorFrom: Date; priorTo: Date } {
  const durationMs = to.getTime() - from.getTime()
  // Use year/month/date arithmetic for the boundary day to avoid DST offset
  const priorToDate = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1)
  const priorFromDate = new Date(priorToDate.getTime() - durationMs)
  return { priorFrom: priorFromDate, priorTo: priorToDate }
}
```

The existing unit tests use `new Date(year, month, day)` (local midnight) and therefore do not catch this — the DST case requires a test at a known transition date.

---

### WR-04: `app/providers.tsx` creates the `QueryClient` as a module-level singleton — causes cross-request cache sharing in SSR and stale state between users in dev HMR

**File:** `app/providers.tsx:7`

**Issue:** The `QueryClient` is declared at module scope outside any component or factory. In Next.js App Router with server-side rendering, module-level singletons are shared across all concurrent requests on the same server instance. This means response A's cached queries can bleed into response B. In development, HMR reloads the module but preserves the singleton cache, causing stale data to persist after refreshes.

The TanStack Query SSR docs explicitly warn against module-scope singleton clients for server rendering and recommend using `useRef` or `useState` inside the provider component.

**Fix:**
```typescript
'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

Because `Providers` is a `'use client'` component, `useState` is only called on the client — one client per browser tab, which is the intended isolation boundary.

---

## Info

### IN-01: `formatters.ts` — `brl()` creates a new `Intl.NumberFormat` instance on every call

**File:** `lib/formatters.ts:1`

**Issue:** Each call to `brl(v)` constructs a new `Intl.NumberFormat` object. On a dashboard page with 7 KPI cards + table rows + channel split labels, this can be 20–50 allocations per render. The same applies to `num()`. Not a blocking issue at 1-3 tenant scale, but straightforward to fix.

**Fix:** Hoist the formatter instances to module scope:
```typescript
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const numFormatter = new Intl.NumberFormat('pt-BR')

export const brl = (v: number) => brlFormatter.format(v)
export const num = (v: number) => numFormatter.format(v)
```

---

### IN-02: `components/campanhas/campaign-sheet.tsx` uses duplicate SVG gradient IDs that will conflict when multiple chart instances render on the same page

**File:** `components/campanhas/campaign-sheet.tsx:160`

**Issue:** The gradient `id` attributes (`gSpend`, `gRoas`, `gCtr`) in the campaign sheet are hardcoded strings. If another chart on the page (e.g., `dashboard/page.tsx` uses `gGoogle`, `gMeta`) adds gradients with the same IDs, SVG ID collisions will cause wrong fill colors. This is a latent risk if more chart-bearing sheets are added, or if the sheet is opened alongside the dashboard area chart simultaneously.

**Fix:** Use unique IDs per component instance via `React.useId()`:
```typescript
const gradientId = React.useId()
// then: id={`${gradientId}-spend`} and fill={`url(#${gradientId}-spend)`}
```

---

### IN-03: `app/[tenant-slug]/settings/page.tsx` — `tenantId` exposed in query key but not needed there; `fetchTenantSettings` resolves slug→id on every query call

**File:** `app/[tenant-slug]/settings/page.tsx:103`

**Issue:** `fetchTenantSettings` always performs a `tenants.select('id').eq('slug', tenantSlug)` roundtrip to resolve the slug to a UUID before reading `ad_accounts`. This adds a sequential Supabase call on every settings page mount. The `queryKey` at line 104 uses `['settings', tenantSlug]` which is correct, but the double fetch is unnecessary if the layout already knows the `tenantId` (it currently does not pass it down).

This is a minor efficiency note, not a bug. No fix required unless a refactor passes `tenantId` through layout → page props.

---

### IN-04: `useDashboardData` hook computes the prior range outside the `queryFn`, causing it to be based on the time of the last render rather than the time of the fetch

**File:** `lib/hooks/use-dashboard-data.ts:43`

**Issue:** `computePriorRange(from, to)` is called during render, before `queryFn` executes. If the component re-renders for reasons unrelated to date range changes (e.g., parent re-render, context update), `priorFrom`/`priorTo` will be recomputed to a potentially different value relative to the cached `from`/`to`. Because `priorFrom`/`priorTo` are not in the `queryKey`, changing them does not invalidate the cache — but the cache was built with the old prior range. In practice the dates are stable `Date` objects from Zustand so this is very unlikely to cause visible bugs, but the `queryKey` should include the prior range dates to be strictly correct.

**Fix:**
```typescript
queryKey: ['dashboard', tenantSlug, from.toISOString(), to.toISOString(), priorFrom.toISOString(), priorTo.toISOString()],
```

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
