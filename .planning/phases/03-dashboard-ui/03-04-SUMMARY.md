---
phase: 03-dashboard-ui
plan: 04
subsystem: campanhas/data-wiring
tags: [tanstack-query, supabase, rls, campaign-aggregation, sheet, recharts, drill-down]
dependency_graph:
  requires:
    - lib/campaign-aggregation.ts (Plan 01 — groupCampaignMetrics, AggregatedCampaign)
    - lib/stores/date-range.ts (Plan 01 — useDateRangeStore)
    - lib/formatters.ts (Plan 01 — brl, num)
    - app/providers.tsx (Plan 02 — QueryClientProvider)
    - components/ui/sheet.tsx (Plan 02 — Sheet via @base-ui/react/dialog)
    - lib/supabase/client.ts (pre-existing browser client singleton)
  provides:
    - lib/hooks/use-campaigns-data.ts (useCampaignsData + useCampaignTimeseries hooks)
    - components/campanhas/campaign-sheet.tsx (drill-down Sheet with trend chart + totals)
    - app/[tenant-slug]/campanhas/page.tsx (real campaign table, channel filter, date-range reactive)
  affects:
    - Plan 03-05 (Insights page — same hook pattern established here)
tech_stack:
  added: []
  patterns:
    - useQuery with reactive queryKey (tenantSlug + from.toISOString() + to.toISOString()) — same pattern as Plan 03
    - RLS-only tenant isolation (no .eq('tenant_id') — JWT-based get_tenant_id() handles it)
    - groupCampaignMetrics() for JS-side aggregation (PostgREST lacks GROUP BY — acceptable for v1/1-3 tenants)
    - Base UI disablePointerDismissal for no-outside-close Sheet (Radix onPointerDownOutside does not exist in @base-ui)
    - Per-day ROAS/CTR derivation in campaign timeseries (conv_value/spend and clicks/impressions with zero-guards)
key_files:
  created:
    - lib/hooks/use-campaigns-data.ts
    - components/campanhas/campaign-sheet.tsx
  modified:
    - app/[tenant-slug]/campanhas/page.tsx
decisions:
  - disablePointerDismissal (Base UI) used instead of onPointerDownOutside (Radix) — sheet.tsx is built on @base-ui/react/dialog, not Radix; Plan 02 SUMMARY documented this deviation for Plan 04 to handle
  - outside-press reason guard in onOpenChange adds explicit semantic layer on top of disablePointerDismissal — redundant but self-documenting
  - groupCampaignMetrics() called in page component (not hook) — separates data fetching concern from aggregation, keeps hook pure (raw rows only)
  - Timeseries trend chart derives ROAS/CTR per day in render (not in hook) — avoids coupling business logic to DB shape in timeseries hook
  - useCampaignTimeseries enabled: !!tenantSlug && !!campaignId — zero queries while no campaign row is selected (lazy)
metrics:
  duration_minutes: 20
  completed_date: "2026-06-05"
  tasks_total: 2
  tasks_completed: 2
  files_created: 2
  files_modified: 1
requirements: [CAMP-01, CAMP-02, CAMP-03, CAMP-04]
---

# Phase 3 Plan 04: Campaigns Page — Real Data + CampaignSheet Drill-down Summary

**One-liner:** `useCampaignsData` and `useCampaignTimeseries` hooks fetch `campaign_metrics` rows (RLS-isolated, queryKey reactive to date range store), `groupCampaignMetrics()` aggregates JS-side, and `CampaignSheet` renders a right-side drill-down with per-day trend area chart + aggregated totals that does not close on outside click via Base UI's `disablePointerDismissal`.

## What Was Built

### lib/hooks/use-campaigns-data.ts

New `'use client'` module exporting two TanStack Query hooks:

**`useCampaignsData(tenantSlug)`** (CAMP-01, CAMP-03):
- Reads `{ from, to }` from `useDateRangeStore()` (Zustand — Plan 01)
- `queryKey: ['campaigns', tenantSlug, from.toISOString(), to.toISOString()]` — reactive to both tenant and date range changes
- `queryFn`: selects `campaign_id, campaign_name, channel, status, date, impressions, clicks, spend, conversions, conversion_value` from `campaign_metrics` filtered by `.gte('date', from).lte('date', to)`
- Returns raw `CampaignMetricRow[]` — caller aggregates with `groupCampaignMetrics()`
- `enabled: !!tenantSlug` — no query fired until tenant is known
- Tenant isolation via RLS only (no `.eq('tenant_id')` — matches threat model T-03-04-01)

**`useCampaignTimeseries(tenantSlug, campaignId)`** (CAMP-04):
- Same date range from store; additional `.eq('campaign_id', campaignId)` filter
- `.order('date', { ascending: true })` for correct chart rendering
- `enabled: !!tenantSlug && !!campaignId` — no query while Sheet is closed (lazy)
- `queryKey: ['campaign-ts', tenantSlug, campaignId, from.toISOString(), to.toISOString()]`

### components/campanhas/campaign-sheet.tsx

New `'use client'` component `CampaignSheet({ tenantSlug, campaign, onClose })`:

- Props: `campaign: AggregatedCampaign | null` — Sheet renders open only when campaign is set
- **D-11 (no-outside-close):** `disablePointerDismissal` prop on `Sheet` (Base UI Dialog primitive); `onOpenChange` additionally guards against `'outside-press'` reason — both Esc and X button still close normally
- **Trend chart:** 3-series `AreaChart` (Spend, ROAS diário, CTR diário) derived per row with zero-guards; gradient fills consistent with dashboard style; skeleton shown while `tsLoading`
- **Totals table:** 8 rows (Impressões, Cliques, CTR, Gasto, Conversões, Conv. Value, CPA, ROAS) from `AggregatedCampaign` pre-aggregated fields; CPA/ROAS show `—` when zero
- Empty timeseries state: "Nenhum dado de tendência no período selecionado."

### app/[tenant-slug]/campanhas/page.tsx (rewritten)

Complete replacement of mock data source:

1. **tenantSlug** from `useParams()` — no prop drilling
2. **Data source:** `useCampaignsData(tenantSlug)` → `groupCampaignMetrics(rawRows)` (Plan 01 aggregation)
3. **Loading state:** `<TableSkeleton />` renders 6 skeleton rows while `isLoading`
4. **Error state:** inline message in table area on `isError`
5. **Channel filter (CAMP-02):** tabs `all / google_ads / meta_ads` — preserved from original, now operates on real `AggregatedCampaign[]`
6. **Search + sort:** preserved exactly from original (name filter, 5 sortable keys)
7. **Row click (CAMP-04):** `onClick={() => setSelected(c)}` + `cursor-pointer` class; `<CampaignSheet>` rendered at section bottom
8. **Subtitle:** dynamically shows campaign count + "no período selecionado" (replaces hardcoded "Últimos 30 dias · N campanhas")
9. **Removed:** `MOCK_CAMPAIGNS`, `Campaign` type from `lib/mock-data`, inline `brl`/`num` formatters (now from `lib/formatters.ts`), `ExternalLink` icon on rows

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 319b16b | feat(03-04): create useCampaignsData and useCampaignTimeseries hooks over campaign_metrics |
| Task 2 | 93f2e06 | feat(03-04): create CampaignSheet drill-down and rewrite campanhas page with real data |

## Decisions Made

1. **`disablePointerDismissal` instead of `onPointerDownOutside`** — `sheet.tsx` (Plan 02) uses `@base-ui/react/dialog`, not Radix UI. The RESEARCH.md Pattern 5 `onPointerDownOutside`/`onInteractOutside` props are Radix-specific and do not exist on Base UI's `Dialog.Root`. Base UI provides `disablePointerDismissal` which achieves D-11 correctly. Documented in Plan 02 SUMMARY as a known deviation for Plan 04 to handle.
2. **`outside-press` reason guard in `onOpenChange`** — Added alongside `disablePointerDismissal` for explicitness and self-documentation. Since `disablePointerDismissal` already prevents the outside-press from firing, this guard is semantically redundant but makes the intent clear to future maintainers.
3. **`groupCampaignMetrics()` called in page, not in hook** — Keeps `useCampaignsData` as a pure data-fetching concern returning raw rows. The aggregation step (Plan 01 pure function) is a separate concern applied in the consumer. This also allows the timeseries hook to share the same raw row type.
4. **Timeseries ROAS/CTR derived in render** — Per-day `roas = conv_value / spend` and `ctr = clicks / impressions` computed in the `trendData` map inside the component. Avoids coupling business logic calculation to the data hook, keeping the hook a pure passthrough of DB rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Base UI `outside-press` reason value (camelCase vs kebab-case)**
- **Found during:** Task 2, TypeScript check after writing CampaignSheet
- **Issue:** Plan used `'outsidePress'` (camelCase) for the Base UI event reason comparison. TypeScript error `TS2367: types '"outside-press" | ...' and '"outsidePress"' have no overlap` — the correct string literal is `'outside-press'` (kebab-case) per `@base-ui/react` source
- **Fix:** Changed `eventDetails?.reason === 'outsidePress'` to `eventDetails?.reason === 'outside-press'`
- **Files modified:** `components/campanhas/campaign-sheet.tsx`
- **Commit:** 93f2e06 (included in Task 2 commit)

**2. [Rule 2 - Missing critical functionality] `disablePointerDismissal` pattern replaces Radix `onPointerDownOutside`**
- **Found during:** Task 2, reading sheet.tsx API (Base UI, not Radix)
- **Issue:** Plan 04 action spec said to use `onPointerDownOutside` which is Radix-only. Base UI uses `disablePointerDismissal` prop on the Root component.
- **Fix:** Used `disablePointerDismissal` on `<Sheet>` (which passes through to `SheetPrimitive.Root` via `...props`) — confirmed in `DialogRoot.d.ts`
- **Files modified:** `components/campanhas/campaign-sheet.tsx`
- **Commit:** 93f2e06

## Known Stubs

None. The page renders real `campaign_metrics` data from Supabase via `useCampaignsData`. The timeseries chart inside `CampaignSheet` uses `useCampaignTimeseries` — when no data exists, an empty-state message is shown (not a stub). No hardcoded values or placeholder text flow to UI.

## Threat Flags

None. Verified against plan threat model:
- T-03-04-01 (cross-tenant leakage): Mitigated — RLS `get_tenant_id()` on `campaign_metrics` enforces isolation. Both hooks intentionally omit `.eq('tenant_id')` per threat model disposition.
- T-03-04-02 (DoS via full-period read + JS aggregation): Accepted — v1 with 1-3 tenants × 90 days × ~10 campaigns ≈ hundreds of rows. Acceptable as documented in RESEARCH.md A4.
- T-03-04-03 (campaign_id in queryKey): Accepted — campaign_id is an external platform ID, not a secret. Exposed only within the tenant user's session.

## Self-Check: PASSED

Files exist:
- FOUND: lib/hooks/use-campaigns-data.ts
- FOUND: components/campanhas/campaign-sheet.tsx
- FOUND: app/[tenant-slug]/campanhas/page.tsx

Commits exist:
- FOUND: 319b16b (Task 1)
- FOUND: 93f2e06 (Task 2)
