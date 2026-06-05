---
phase: 03-dashboard-ui
plan: 03
subsystem: dashboard/data-wiring
tags: [tanstack-query, supabase, rls, kpi-cards, recharts, zustand, daily-rollups]
dependency_graph:
  requires:
    - lib/dashboard-kpis.ts (Plan 01 — aggregateRollups, calcDelta, computePriorRange, computeChannelSplit)
    - lib/stores/date-range.ts (Plan 01 — useDateRangeStore)
    - lib/formatters.ts (Plan 01 — brl, num)
    - app/providers.tsx (Plan 02 — QueryClientProvider)
    - lib/supabase/client.ts (pre-existing browser client singleton)
  provides:
    - lib/hooks/use-dashboard-data.ts (useDashboardData hook — current + prior range over daily_rollups)
    - app/[tenant-slug]/dashboard/page.tsx (7 KPI cards + trend chart + channel split wired to real data)
  affects:
    - Plans 03-04 through 03-05 (pattern established for data hooks + page wiring)
tech_stack:
  added: []
  patterns:
    - useQuery with reactive queryKey (tenantSlug + from.toISOString() + to.toISOString()) for automatic re-fetch on date range change
    - Promise.all for parallel current + prior period queries
    - RLS-only tenant isolation (no .eq('tenant_id') in client — JWT-based get_tenant_id() handles it)
    - channel='all' rows for cross-channel KPI totals; channel='google_ads'/'meta_ads' for split
    - pct=null from calcDelta rendered as em-dash (no NaN/Infinity in UI)
    - Skeleton grid while isLoading; inline error message on isError
key_files:
  created:
    - lib/hooks/use-dashboard-data.ts
  modified:
    - app/[tenant-slug]/dashboard/page.tsx
decisions:
  - RLS handles tenant isolation exclusively — useDashboardData does NOT add .eq('tenant_id') (matches threat model T-03-03-01)
  - pct null displayed as em-dash (—) in KpiCard badge — consistent with Plan 01 calcDelta contract
  - Trend chart pivots JS-side from individual channel rows into {date, google, meta} map (no extra Supabase query)
  - formatDateLabel extracts dd/MM from ISO string via split('-') to avoid timezone-sensitive Date parsing
  - AccountBalanceCard removed — no real data source for account balances in v1 (not a DASH-0x requirement)
metrics:
  duration_minutes: 4
  completed_date: "2026-06-05"
  tasks_total: 2
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements: [DASH-01, DASH-02, DASH-03]
---

# Phase 3 Plan 03: Dashboard Data Wiring — 7 KPI Cards, Trend Chart, Channel Split Summary

**One-liner:** `useDashboardData` hook fetches current + prior `daily_rollups` periods in parallel via TanStack Query (RLS-isolated, queryKey reactive to date range store), wiring all 7 KPI cards with period-over-period deltas, a daily spend trend chart, and a Google/Meta channel split pie into the dashboard page — replacing all mock data.

## What Was Built

### lib/hooks/use-dashboard-data.ts

New `'use client'` hook exporting `useDashboardData(tenantSlug: string)`.

- Reads `{ from, to }` from `useDateRangeStore()` (Zustand — Plan 01)
- Computes `{ priorFrom, priorTo }` via `computePriorRange(from, to)` (Plan 01)
- `queryKey: ['dashboard', tenantSlug, from.toISOString(), to.toISOString()]` — reactive to both tenant and date range changes
- `queryFn`: two parallel queries via `Promise.all`:
  1. Current period: `daily_rollups` rows `gte(from) lte(to)`
  2. Prior period: `daily_rollups` rows `gte(priorFrom) lte(priorTo)`
- Returns `{ current: DailyRollupRow[]; prior: DailyRollupRow[] }`
- `enabled: !!tenantSlug` — no query fired until tenant is known
- Tenant isolation via RLS only (no `.eq('tenant_id')` — matches threat model T-03-03-01)

### app/[tenant-slug]/dashboard/page.tsx (rewritten)

Complete rewrite of the dashboard page:

1. **tenantSlug** read from `useParams()` — no prop drilling needed
2. **Loading state**: `<DashboardSkeleton />` renders 7 `<Skeleton>` cards + 2 chart skeletons while `isLoading`
3. **Error state**: inline card message "Erro ao carregar dados do dashboard." on `isError`
4. **Aggregation**: `aggregateRollups(data.current.filter(r => r.channel === 'all'))` for current; same for prior — uses cross-channel rows confirmed by migration 0010 `UNION ALL` that generates `channel='all'`
5. **7 KPI cards (DASH-01)**:
   - Gasto Total (brl, negative polarity)
   - ROAS (×, positive polarity)
   - CPA (brl, negative polarity)
   - CTR (%, positive polarity)
   - Impressões (num, positive polarity)
   - Cliques (num, positive polarity)
   - Conversões (num, positive polarity)
   - Delta badge shows `pct%` with arrow icon when prior data exists; shows `—` (em-dash) when `pct === null` — no NaN/Infinity
6. **Trend chart (DASH-02)**: JS pivot of `google_ads` + `meta_ads` rows into `{ date: 'dd/MM', google, meta }` map, sorted by ISO date string
7. **Channel split (DASH-03)**: sums `total_spend` per channel, passes to `computeChannelSplit()`, feeds `PieChart` + legend with `brl(value)` and `pct%`
8. **Removed**: `AccountBalanceCard`, `MOCK_ACCOUNT_BALANCES`, `MOCK_CAMPAIGNS`, `MOCK_CHANNEL_SPLIT`, `MOCK_KPIS`, `MOCK_SPEND_HISTORY`, all `lib/mock-data` imports

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 3e407ee | feat(03-03): create useDashboardData hook with current + prior range queries |
| Task 2 | 9d8c7f3 | feat(03-03): rewrite dashboard page with 7 KPI cards, trend chart and channel split from daily_rollups |

## Decisions Made

1. **RLS-only tenant isolation** — `useDashboardData` does NOT add `.eq('tenant_id')` to queries. The Supabase JWT carries `get_tenant_id()` via RLS policy, which is the authoritative trust boundary (T-03-03-01 mitigated). Client-side filtering would be bypassed by a tampered JWT anyway.
2. **`pct=null` displayed as em-dash** — When the prior period has zero data, `calcDelta` returns `pct: null` (Plan 01 contract). `KpiCard` renders `—` in the badge instead of attempting to display `Infinity%` or `NaN%`. Matches RESEARCH.md Pitfall 7.
3. **JS-side pivot for trend chart** — No additional Supabase query. The `google_ads` and `meta_ads` channel rows are already in `data.current`; a Map-based pivot in JS produces the `{ date, google, meta }` series needed by Recharts AreaChart.
4. **ISO string split for date label** — `formatDateLabel('2026-06-05')` → `'05/06'` using `split('-')` to avoid `new Date('YYYY-MM-DD')` UTC vs local timezone ambiguity. Deterministic, zero-dependency.
5. **AccountBalanceCard removed** — Account balance data has no real source in v1 (not a DASH-0x requirement). Keeping it with mock data would introduce a Known Stub that prevents plan goal achievement.

## Deviations from Plan

None — plan executed exactly as written. Both files created/modified per spec, all acceptance criteria met, `npm run build` exits 0.

## Known Stubs

None. All UI data flows from real `daily_rollups` queries via `useDashboardData`. No hardcoded values, no placeholder text, no props receiving empty/mock data.

## Threat Flags

None. Verified against plan threat model:
- T-03-03-01 (cross-tenant leakage): Mitigated — RLS `get_tenant_id()` on `daily_rollups` enforces isolation. Hook intentionally omits `.eq('tenant_id')` per threat model disposition.
- T-03-03-02 (information disclosure): Accepted — only aggregated metrics of own tenant rendered; no secrets in bundle.
- T-03-03-03 (DoS via full-table read): Accepted — pre-aggregated table, ~270 rows max for 90 days × 3 channels × 1 tenant.

## Self-Check: PASSED

Files exist:
- FOUND: lib/hooks/use-dashboard-data.ts
- FOUND: app/[tenant-slug]/dashboard/page.tsx

Commits exist:
- FOUND: 3e407ee (Task 1)
- FOUND: 9d8c7f3 (Task 2)
