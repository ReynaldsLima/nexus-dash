---
phase: 03-dashboard-ui
plan: 06
subsystem: ui
tags: [recharts, sheet, drill-down, piechart, channel-analytics, tanstack-query]

# Dependency graph
requires:
  - phase: 03-03
    provides: "useCampaignsData hook, groupCampaignMetrics, CampaignSheet pattern with disablePointerDismissal"
provides:
  - "ChannelSheet component with 3-section drill-down (spend chart, metrics, top campaigns)"
  - "PieChart in DashboardPage wired with onClick to open ChannelSheet"
  - "GAP-03-01 closed: channel click drill-down fully operational"
affects: [03-dashboard-ui-verification, future-super-admin-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CHANNEL_KEY_MAP lookup pattern: display name ('Google Ads') → DB key ('google_ads') without switch"
    - "Sheet drill-down reuse: disablePointerDismissal + outside-press guard from CampaignSheet"
    - "channelRows derived state: filter data.current by channel before passing to Sheet"
    - "Inline sub-components with TODO extract comment for future Phase 3 refactor"

key-files:
  created:
    - components/dashboard/channel-sheet.tsx
  modified:
    - app/[tenant-slug]/dashboard/page.tsx

key-decisions:
  - "channelRows passed as prop from DashboardPage rather than re-fetching inside ChannelSheet — avoids extra Supabase query since data.current already loaded"
  - "CHANNEL_KEY_MAP object lookup (not switch) for 'Google Ads'/'Meta Ads' → 'google_ads'/'meta_ads' mapping — consistent with plan spec"
  - "ChannelBadge and TotalsRow duplicated inline in channel-sheet.tsx with TODO comment — no extraction blocker for v1"
  - "ChartConfig explicit type annotation added to spendConfig to resolve TypeScript inference issue"

patterns-established:
  - "PieChart drill-down: onClick on <Pie> sets selectedChannel state, <ChannelSheet> renders based on that state"
  - "Sheet not closable on outside click: disablePointerDismissal prop + guard on eventDetails.reason === 'outside-press'"

requirements-completed: [DASH-03-ext]

# Metrics
duration: 15min
completed: 2026-06-05
---

# Phase 03 Plan 06: Channel Drill-Down (GAP-03-01) Summary

**PieChart click on Google Ads or Meta Ads slice opens a 520px Sheet with AreaChart spend, 6 aggregated metrics, and top-5 campaigns via useCampaignsData — closes GAP-03-01**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-05T00:00:00Z
- **Completed:** 2026-06-05T00:15:00Z
- **Tasks:** 2 (Task 1 was pre-committed; Task 2 committed in this session)
- **Files modified:** 2

## Accomplishments
- Created `components/dashboard/channel-sheet.tsx` with 3 sections: Gasto no Período (AreaChart), Métricas do Canal (6 TotalsRow), Top Campanhas (up to 5 via useCampaignsData + groupCampaignMetrics)
- Wired `<ChannelSheet>` into `DashboardPage` with `selectedChannel` state, `CHANNEL_KEY_MAP` lookup, `channelRows` derived from `data.current`, and `onClick` on `<Pie>` elements
- Added `cursor: 'pointer'` style to both `<Cell>` elements in PieChart for interaction affordance
- Sheet closes only via X button or Esc (not on outside click) — `disablePointerDismissal` + `outside-press` guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar components/dashboard/channel-sheet.tsx** - `f0e4a9b` (feat)
2. **Task 2: Adicionar onClick no PieChart e integrar ChannelSheet** - `5c30b83` (feat)

## Files Created/Modified
- `components/dashboard/channel-sheet.tsx` - ChannelSheet component with 3-section drill-down, inline ChannelBadge/StatusDot/TotalsRow sub-components, AreaChart for daily spend, aggregated metrics, top campaigns list
- `app/[tenant-slug]/dashboard/page.tsx` - Added useState for selectedChannel, CHANNEL_KEY_MAP, channelRows derived state, onClick+cursor on Pie/Cell, and ChannelSheet in return JSX

## Decisions Made
- `channelRows` filtered in `DashboardPage` and passed as prop — avoids re-querying Supabase since `data.current` already has all daily rollup rows for the period
- `CHANNEL_KEY_MAP` object lookup chosen over switch for channel name mapping (display → DB key)
- `ChannelBadge` and `TotalsRow` duplicated inline in ChannelSheet with `// TODO: extract to shared` comment — acceptable for v1, no blocking refactor needed
- Explicit `ChartConfig` type annotation on `spendConfig` added as minor deviation to resolve TypeScript inference (Rule 1 auto-fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added explicit ChartConfig type annotation to spendConfig**
- **Found during:** Task 1 (creating channel-sheet.tsx)
- **Issue:** TypeScript could not infer `ChartConfig` type on `spendConfig` variable from ternary expression, causing implicit `any` warning
- **Fix:** Added `import type { ChartConfig }` and explicit `: ChartConfig` annotation to `spendConfig` declaration
- **Files modified:** components/dashboard/channel-sheet.tsx
- **Verification:** `npx tsc --noEmit` shows zero errors in app/components/lib (only preexisting errors in tests/)
- **Committed in:** `5c30b83` (Task 2 commit alongside dashboard/page.tsx)

---

**Total deviations:** 1 auto-fixed (1 TypeScript type annotation)
**Impact on plan:** Minor correctness fix. No scope creep.

## Issues Encountered
- Preexisting TypeScript errors in `tests/integration/vault-rpc.test.ts` and `tests/tenants.test.ts` — out of scope, not introduced by this plan. Errors exist in test files only and do not affect the application build.

## Known Stubs
None — all 3 sections are fully wired to live data sources:
- Section 1: `channelRows` prop (from `data.current` filtered by channel)
- Section 2: aggregated from `channelRows` reducers
- Section 3: `useCampaignsData` + `groupCampaignMetrics` + channel filter

## Threat Flags
No new security-relevant surface introduced. ChannelSheet reads the same `data.current` passed from DashboardPage (already RLS-isolated via useDashboardData) and `useCampaignsData` (existing hook with RLS on `campaign_metrics` table). No new network endpoints, auth paths, or schema changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GAP-03-01 fully closed: channel drill-down operational
- DashboardPage pattern established for future drill-downs (e.g., campaign-level drill-down)
- ChannelBadge/TotalsRow/StatusDot can be extracted to shared components in a future refactor phase

## Self-Check: PASSED

- `components/dashboard/channel-sheet.tsx` — FOUND
- `app/[tenant-slug]/dashboard/page.tsx` — FOUND (modified)
- Commit `f0e4a9b` (Task 1) — FOUND
- Commit `5c30b83` (Task 2) — FOUND

---
*Phase: 03-dashboard-ui*
*Completed: 2026-06-05*
