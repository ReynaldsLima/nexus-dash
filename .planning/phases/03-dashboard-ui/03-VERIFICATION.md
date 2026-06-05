---
phase: 03-dashboard-ui
verified: 2026-06-05T01:30:00Z
status: gaps_found
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify migrations 0013 and 0014 are applied to remote Supabase project"
    expected: "create_or_update_vault_secret RPC exists in DB; authenticator grant revoked"
    result: "RESOLVED — REVOKE applied via SQL Editor on 2026-06-05; HTTP 401 confirmed for anon callers"
  - test: "Confirm 'clicking a channel' drill-down intent for ROADMAP SC3"
    expected: "Confirm whether the channel PieChart in dashboard should open a drill-down on click"
    result: "GAP — User decision 2026-06-05: add channel drill-down as gap closure (option b)"
gaps:
  - id: GAP-03-01
    description: "Channel click drill-down no PieChart do dashboard (ROADMAP SC3)"
    requirement: "DASH-03-ext"
    detail: "Dashboard PieChart de channel split deve abrir drill-down ao clicar em um canal (Google Ads ou Meta Ads). Mostrar métricas detalhadas do canal para o período selecionado. Complementa CAMP-04 (drill-down de campanha já implementado)."
    status: open
---

# Phase 3: Dashboard UI Verification Report

**Phase Goal:** Dashboard UI com dados reais — KPI cards, trend charts, campanhas com drill-down e Settings com conexão Meta Ads
**Verified:** 2026-06-05
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pure date-range preset functions return correct from/to dates for all 5 presets | ✓ VERIFIED | `lib/stores/date-range.ts` exports `getPresetRange`; 13 tests pass in `date-range-store.test.ts` |
| 2 | KPI aggregation sums daily_rollups rows and derives ROAS/CPA/CTR with zero-guards | ✓ VERIFIED | `lib/dashboard-kpis.ts` exports `aggregateRollups`; 17 tests pass in `dashboard-kpis.test.ts` |
| 3 | Period-over-period delta returns absolute + pct and returns null when prior period has zero base | ✓ VERIFIED | `calcDelta` returns `pct: null` (not 0) for zero base; tested in dashboard-kpis.test.ts |
| 4 | Campaign metrics rows grouped by campaign_id with summed metrics and derived ROAS/CPA/CTR | ✓ VERIFIED | `groupCampaignMetrics` in `lib/campaign-aggregation.ts`; 16 tests pass including ACTIVE/ENABLED status |
| 5 | Channel split computes google vs meta percentage summing to 100 | ✓ VERIFIED | `computeChannelSplit` in `lib/dashboard-kpis.ts`; 5 tests pass in `channel-split.test.ts` |
| 6 | npm test (4 Phase 3 unit files) passes with all 51 tests green | ✓ VERIFIED | `npm test -- date-range-store channel-split dashboard-kpis campaign-aggregation` → 51 passed |
| 7 | App is wrapped in QueryClientProvider so useQuery works app-wide | ✓ VERIFIED | `app/providers.tsx` exports `Providers` with `QueryClientProvider`; `app/layout.tsx` wraps children in `<Providers>` |
| 8 | Global date range picker in header on every authenticated page, default Last 30 days | ✓ VERIFIED | `components/dashboard/date-range-picker.tsx` wired to `useDateRangeStore`; `app/[tenant-slug]/layout.tsx` uses `<HeaderActions>` with `<DateRangePicker>` |
| 9 | Dashboard shows 7 KPI cards from daily_rollups with period-over-period deltas; trend chart; channel split | ✓ VERIFIED | `dashboard/page.tsx` imports `useDashboardData`, `aggregateRollups`, `calcDelta`, `computeChannelSplit`; 7 KpiCard invocations (grep count=9 including definition); no MOCK_ references |
| 10 | Campaigns page lists real campaigns from campaign_metrics; channel filter; date-range reactive; CampaignSheet drill-down that does not close on outside click | ✓ VERIFIED | `use-campaigns-data.ts` queries `campaign_metrics`; `campanhas/page.tsx` uses `groupCampaignMetrics` + `CampaignSheet`; `disablePointerDismissal` on Sheet (Base UI); `enabled: !!tenantSlug && !!campaignId` guard |
| 11 | Settings page exists with Meta Ads form, Google Ads deferred section, and sidebar link | ✓ VERIFIED | `app/[tenant-slug]/settings/page.tsx` has `MetaAdsForm` + Google Ads deferred card; `sidebar-nav.tsx` has Settings icon + `/${slug}/settings` href |
| 12 | Meta Ads Route Handler validates token, writes to Vault, upserts ad_accounts; token never logged or returned | ✓ VERIFIED | `app/api/meta-ads/connect/route.ts`: auth check → role check → Zod validation → tenant ownership → double Meta Graph API validation → Vault RPC → ad_accounts upsert; no `console.log(token)` found |
| 13 | Migration 0013 creates create_or_update_vault_secret RPC with correct SECURITY DEFINER and grants | ✓ VERIFIED (code) | `supabase/migrations/0013_create_vault_write_function.sql` has SECURITY DEFINER, REVOKE PUBLIC/anon/authenticated, GRANT service_role; 0014 revokes authenticator grant |
| 14 | Migrations 0013 and 0014 applied to remote Supabase DB | ? UNCERTAIN | Migration files committed; `supabase db push` not run (SUPABASE_DB_PASSWORD not in dev env per SUMMARY). Route Handler cannot function until migration is applied. |
| 15 | Channel PieChart in dashboard supports click drill-down (ROADMAP SC3: "clicking a channel or campaign") | ✗ NOT IMPLEMENTED | Dashboard PieChart has no `onClick` handler. No requirement (DASH-03) nor any plan task specifies this behavior. Campaign drill-down (CAMP-04 / CampaignSheet) is fully implemented. |

**Score:** 13/15 truths verified (10/10 plan must-haves verified; 2 items require human judgment)

### Deferred Items

No items deferred to later phases — Phase 4 covers AI Insights only.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/formatters.ts` | brl/num formatters | ✓ VERIFIED | Exports `brl` and `num` with pt-BR Intl |
| `lib/stores/date-range.ts` | Zustand store + getPresetRange | ✓ VERIFIED | Exports `PresetKey`, `DateRange`, `getPresetRange`, `useDateRangeStore`; default `last30` |
| `lib/dashboard-kpis.ts` | aggregateRollups, calcDelta, computePriorRange, computeChannelSplit | ✓ VERIFIED | All 4 functions exported; zero-guards on ROAS/CPA/CTR; `pct: null` for zero prior |
| `lib/campaign-aggregation.ts` | groupCampaignMetrics | ✓ VERIFIED | Groups by campaign_id Map; ENABLED+ACTIVE→active; `convValue` field |
| `app/providers.tsx` | QueryClientProvider singleton | ✓ VERIFIED | `'use client'`, `useState` factory pattern (SSR-safe after WR-04 fix) |
| `components/layout/header-actions.tsx` | Client wrapper with DateRangePicker | ✓ VERIFIED | Contains `DateRangePicker`, `TenantSwitcher`, `LogoutButton` |
| `components/dashboard/date-range-picker.tsx` | Popover + presets + Calendar wired to store | ✓ VERIFIED | Contains `useDateRangeStore`, `mode="range"`, 5 presets |
| `components/ui/sheet.tsx` | shadcn Sheet component | ✓ VERIFIED | File exists via `@base-ui/react/dialog` |
| `components/ui/popover.tsx` | shadcn Popover | ✓ VERIFIED | File exists |
| `components/ui/calendar.tsx` | shadcn Calendar | ✓ VERIFIED | File exists; `month_grid` fix applied for react-day-picker v10 |
| `lib/hooks/use-dashboard-data.ts` | useDashboardData hook | ✓ VERIFIED | `useQuery`, `from('daily_rollups')`, `useDateRangeStore`, `computePriorRange`, `Promise.all`; no `.eq('tenant_id')` |
| `app/[tenant-slug]/dashboard/page.tsx` | 7 KPI cards + trend + channel split | ✓ VERIFIED | `useDashboardData`, `aggregateRollups`, `calcDelta`, `computeChannelSplit`, `useParams`, `Skeleton`; no MOCK_ |
| `lib/hooks/use-campaigns-data.ts` | useCampaignsData + useCampaignTimeseries | ✓ VERIFIED | Both hooks, `from('campaign_metrics')`, enabled guard with campaignId; no `.eq('tenant_id')` |
| `components/campanhas/campaign-sheet.tsx` | Sheet drill-down with no-outside-close | ✓ VERIFIED | Contains `Sheet`, `useCampaignTimeseries`, `disablePointerDismissal`, `outside-press` guard |
| `app/[tenant-slug]/campanhas/page.tsx` | Real campaign table + filter + date-range + CampaignSheet | ✓ VERIFIED | `useCampaignsData`, `groupCampaignMetrics`, `CampaignSheet`, `cursor-pointer`, channel filter tabs; no MOCK_ |
| `supabase/migrations/0013_create_vault_write_function.sql` | create_or_update_vault_secret RPC | ✓ VERIFIED (committed) | SECURITY DEFINER, REVOKE, GRANT service_role; `RETURNS UUID` |
| `supabase/migrations/0014_revoke_authenticator_vault_write.sql` | CR-02 fix: revoke authenticator | ✓ VERIFIED (committed) | Revokes authenticator execute grant |
| `app/api/meta-ads/connect/route.ts` | POST handler with full security chain | ✓ VERIFIED | `graph.facebook.com/v22.0/me`, `graph.facebook.com/v22.0/`, `createServiceClient`, `create_or_update_vault_secret`, `from('ad_accounts')`, `onConflict`, 401 path, 403 path, `runtime = 'nodejs'` |
| `components/settings/meta-ads-form.tsx` | RHF + Zod form | ✓ VERIFIED | `useForm`, `zodResolver`, `/api/meta-ads/connect` |
| `app/[tenant-slug]/settings/page.tsx` | Settings page with badges | ✓ VERIFIED | `MetaAdsForm`, `from('ad_accounts')`, Google Ads deferred section |
| `components/layout/sidebar-nav.tsx` | Settings nav link | ✓ VERIFIED | `Settings` icon, `/${slug}/settings` href |
| `types/database.types.ts` | create_or_update_vault_secret in Functions | ✓ VERIFIED | Line 318: `create_or_update_vault_secret:` present (manually patched) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/layout.tsx` | `app/providers.tsx` | `<Providers>` wraps children | ✓ WIRED | Line 42-44: `<Providers><TenantStoreProvider>{children}</TenantStoreProvider></Providers>` |
| `app/[tenant-slug]/layout.tsx` | `components/layout/header-actions.tsx` | `<HeaderActions>` in header | ✓ WIRED | Line 4: import; Line 48: `<HeaderActions role tenants activeSlug>` |
| `components/dashboard/date-range-picker.tsx` | `lib/stores/date-range.ts` | import `useDateRangeStore` | ✓ WIRED | `from '@/lib/stores/date-range'` |
| `lib/hooks/use-dashboard-data.ts` | `daily_rollups` | `supabase.from('daily_rollups').select` | ✓ WIRED | `from('daily_rollups')` in queryFn |
| `lib/hooks/use-dashboard-data.ts` | `lib/stores/date-range.ts` | `useDateRangeStore` in queryKey | ✓ WIRED | `queryKey: ['dashboard', tenantSlug, from.toISOString(), to.toISOString()]` |
| `app/[tenant-slug]/dashboard/page.tsx` | `lib/dashboard-kpis.ts` | `aggregateRollups` usage | ✓ WIRED | `aggregateRollups`, `calcDelta`, `computeChannelSplit` all imported and used |
| `lib/hooks/use-campaigns-data.ts` | `campaign_metrics` | `supabase.from('campaign_metrics').select` | ✓ WIRED | `from('campaign_metrics')` |
| `app/[tenant-slug]/campanhas/page.tsx` | `lib/campaign-aggregation.ts` | `groupCampaignMetrics` | ✓ WIRED | `groupCampaignMetrics(rawRows)` on line 80 |
| `app/[tenant-slug]/campanhas/page.tsx` | `components/campanhas/campaign-sheet.tsx` | `<CampaignSheet>` | ✓ WIRED | `<CampaignSheet tenantSlug campaign={selected} onClose>` |
| `components/settings/meta-ads-form.tsx` | `/api/meta-ads/connect` | `fetch POST` | ✓ WIRED | `fetch('/api/meta-ads/connect', { method: 'POST', ... })` |
| `app/api/meta-ads/connect/route.ts` | `create_or_update_vault_secret` | `service.rpc(...)` | ✓ WIRED (code) | `service.rpc('create_or_update_vault_secret', {...})`; migration not applied to DB yet |
| `app/api/meta-ads/connect/route.ts` | `ad_accounts` | `service.from('ad_accounts').upsert` | ✓ WIRED (code) | `service.from('ad_accounts').upsert({...}, { onConflict: 'tenant_id,channel' })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `app/[tenant-slug]/dashboard/page.tsx` | `data.current`, `data.prior` | `useDashboardData` → `daily_rollups` Supabase query | Yes — `from('daily_rollups').select(...).gte().lte()` | ✓ FLOWING |
| `app/[tenant-slug]/campanhas/page.tsx` | `campaigns` (via `rawRows`) | `useCampaignsData` → `campaign_metrics` Supabase query | Yes — `from('campaign_metrics').select(...).gte().lte()` | ✓ FLOWING |
| `app/[tenant-slug]/settings/page.tsx` | `data.metaStatus`, `data.tenantId` | `useQuery` → `tenants` + `ad_accounts` Supabase queries | Yes — `from('ad_accounts').select('channel,active')` | ✓ FLOWING (pending migration apply for write path) |
| `components/campanhas/campaign-sheet.tsx` | `tsRows` | `useCampaignTimeseries` → `campaign_metrics` with `.eq('campaign_id')` | Yes — real DB query; empty state shown when no rows | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 3 unit tests (51 tests) | `npm test -- date-range-store dashboard-kpis channel-split campaign-aggregation` | 51 passed | ✓ PASS |
| No MOCK_ in dashboard page | `grep -n "MOCK_" dashboard/page.tsx` | No output | ✓ PASS |
| No MOCK_ in campanhas page | `grep -n "MOCK_" campanhas/page.tsx` | No output | ✓ PASS |
| No token logging in route handler | `grep -n "console.log.*token" route.ts` | No output | ✓ PASS |
| TanStack Query dependency | `grep "@tanstack/react-query" package.json` | `"^5.101.0"` | ✓ PASS |
| disablePointerDismissal in Sheet | `grep "disablePointerDismissal" campaign-sheet.tsx` | Found line 123 | ✓ PASS |
| Migrations exist | `ls supabase/migrations/0013* 0014*` | Both files found | ✓ PASS |
| Integration tests (DB required) | `npm test` full suite | 4 test files fail — `fetch failed` (no local Supabase running) | ? SKIP (expected without local DB) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DASH-01 | 03-03-PLAN | 7 KPI cards with period-over-period deltas | ✓ SATISFIED | 7 KpiCard invocations in dashboard/page.tsx; `calcDelta` used for all 7; em-dash for null pct |
| DASH-02 | 03-03-PLAN | Trend charts (line, time-series) for selected period | ✓ SATISFIED | AreaChart in dashboard/page.tsx with trendData pivoted from `google_ads`/`meta_ads` channel rows |
| DASH-03 | 03-03-PLAN | Channel breakdown Google vs Meta absolute + % | ✓ SATISFIED | PieChart + legend in dashboard/page.tsx using `computeChannelSplit`; shows `brl(value)` and `pct%` |
| DASH-04 | 03-02-PLAN | Global date range picker with presets, default Last 30 days | ✓ SATISFIED | `DateRangePicker` in header, 5 presets, Zustand store default `last30`, persists via in-memory store |
| CAMP-01 | 03-04-PLAN | Campaigns list with Name, Channel, Status, Spend, ROAS, CPA, CTR, Clicks, Conversions | ✓ SATISFIED | campanhas/page.tsx renders all columns from `AggregatedCampaign`; real data from `campaign_metrics` |
| CAMP-02 | 03-04-PLAN | Filter campaigns by channel | ✓ SATISFIED | Channel filter tabs (all/google_ads/meta_ads) preserved from original, operating on real data |
| CAMP-03 | 03-04-PLAN | Campaigns respects global date range | ✓ SATISFIED | `useCampaignsData` queryKey includes `from.toISOString()` + `to.toISOString()` — reactive to store |
| CAMP-04 | 03-04-PLAN | Campaign drill-down with trend lines | ✓ SATISFIED | `CampaignSheet` renders per-day AreaChart (Spend/ROAS/CTR) + totals table; no-outside-close via `disablePointerDismissal` |
| SET-01 | 03-05-PLAN | Tenant Admin connects Google Ads via OAuth2 | ✓ SATISFIED (deferred) | Settings page shows Google Ads section as "Não configurado" with deferral note per plan spec |
| SET-02 | 03-05-PLAN | Tenant Admin connects Meta Ads via System User token | ✓ SATISFIED (UAT approved; migration pending apply) | Route Handler validates token, writes to Vault, upserts ad_accounts; UAT approved per 03-05-SUMMARY |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/[tenant-slug]/insights/page.tsx` | 8, 162, 210 | `MOCK_INSIGHTS` still in insights page | ℹ Info | Phase 4 scope — not a Phase 3 artifact |

No anti-patterns found in Phase 3 artifacts (dashboard, campanhas, settings, hooks, pure functions).

### Human Verification Required

#### 1. Apply Migrations 0013 and 0014 to Remote Supabase DB

**Test:** Run `supabase db push --password <SUPABASE_DB_PASSWORD>` or apply migrations via Supabase Dashboard SQL editor. Then verify `create_or_update_vault_secret` exists in DB by calling it from psql or Supabase Dashboard.

**Expected:** Both migrations applied; `create_or_update_vault_secret` function exists with `service_role` grant only (no `authenticator` grant); `read_vault_secret` should also be reviewed for the same authenticator grant issue.

**Why human:** `supabase db push` requires `SUPABASE_DB_PASSWORD` not available in local dev env. This is a deployment action requiring credentials. Until applied, the META Ads token connection flow will fail at step 6 (Vault RPC).

#### 2. Confirm "Channel Click Drill-Down" Intent (ROADMAP SC3)

**Test:** Review ROADMAP SC3: "A channel breakdown section shows Google Ads vs. Meta Ads in absolute values and percentage contribution; clicking a channel or campaign opens a drill-down view with detailed time-series metrics."

**Expected:** Product owner clarifies whether:
- (A) "or campaign" is the intended drill-down path (satisfied by CampaignSheet), and the PieChart is display-only — ROADMAP wording was imprecise, OR
- (B) The PieChart in the dashboard should also open a channel-specific drill-down (would require a new component showing per-campaign breakdown for a selected channel)

**Why human:** No individual requirement (DASH-03 says only "absolute values and percentage contribution"), no plan task, and no SUMMARY claims this behavior. All 5 plans for Phase 3 are complete and none include a channel-click drill-down. This is a product intent question, not an implementation bug.

#### 3. End-to-End Meta Ads Connection Validation (Post-Migration)

**Test:** After applying migrations, run the Settings page UAT with a valid Meta System User token (steps from Plan 05 Task 4).

**Expected:** Valid token → badge "Conectado" + ad_accounts row + Vault secret. Invalid token → inline error, nothing persisted.

**Why human:** UAT was previously approved per 03-05-SUMMARY, but that was before confirming migration apply status. Re-confirm once 0013/0014 are deployed to the remote DB.

### Gaps Summary

No blocking gaps in the codebase implementation. All 10 requirement IDs are addressed in code. The two open items are:

1. **Migration deployment** — A manual ops action to apply committed SQL files to the remote DB. The route handler code is correct; only the DB function is missing from the live environment.

2. **ROADMAP SC3 channel click drill-down** — A product intent ambiguity. The campaign drill-down (CAMP-04) is fully implemented. The channel PieChart is display-only as delivered by all 5 plans. No requirement specifies a channel-click action. This needs a product decision before it can be implemented or accepted as-is.

---

_Verified: 2026-06-05T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
