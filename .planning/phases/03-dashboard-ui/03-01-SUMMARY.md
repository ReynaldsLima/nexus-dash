---
phase: 03-dashboard-ui
plan: 01
subsystem: lib/pure-logic
tags: [tdd, pure-functions, zustand, kpi, date-range, campaign-aggregation]
dependency_graph:
  requires: []
  provides:
    - lib/formatters.ts (brl/num formatters)
    - lib/stores/date-range.ts (useDateRangeStore + getPresetRange)
    - lib/dashboard-kpis.ts (aggregateRollups, calcDelta, computePriorRange, computeChannelSplit)
    - lib/campaign-aggregation.ts (groupCampaignMetrics)
  affects:
    - Plans 03-02 through 03-05 (all downstream plans consume these pure functions)
tech_stack:
  added: []
  patterns:
    - Pure function modules with zero-guard arithmetic
    - Zustand v5 module singleton store (no Provider needed for client-side in-memory state)
    - TDD RED → GREEN cycle within single plan
key_files:
  created:
    - lib/formatters.ts
    - lib/stores/date-range.ts
    - lib/dashboard-kpis.ts
    - lib/campaign-aggregation.ts
    - tests/unit/date-range-store.test.ts
    - tests/unit/dashboard-kpis.test.ts
    - tests/unit/channel-split.test.ts
    - tests/unit/campaign-aggregation.test.ts
  modified: []
decisions:
  - calcDelta returns pct: null (not 0) when prior === 0 — callers must handle null to display '—' in UI
  - groupCampaignMetrics status determined by row with latest date string (lexicographic sort safe for YYYY-MM-DD)
  - All numeric inputs coerced via Number() to handle Supabase numeric-as-string edge cases
  - date-range store uses module singleton pattern (create from zustand) — no Provider wrapper needed
metrics:
  duration_minutes: 15
  completed_date: "2026-06-04"
  tasks_total: 3
  tasks_completed: 3
  files_created: 8
  files_modified: 0
  tests_added: 50
requirements: [DASH-04, DASH-01, DASH-03, CAMP-01]
---

# Phase 3 Plan 01: Pure Logic Layer — KPI, Date Range, Campaign Aggregation Summary

**One-liner:** Four pure-function modules (formatters, Zustand date-range store with presets, KPI aggregation with zero-guards, campaign grouping by campaign_id) backed by 50 green unit tests — Wave 0 foundation for all downstream Phase 3 plans.

## What Was Built

### lib/formatters.ts
Extracted `brl()` and `num()` formatters that were duplicated inline in `dashboard/page.tsx` and `campanhas/page.tsx`. Identical signatures — drop-in replacement for both files.

### lib/stores/date-range.ts
Zustand v5 module singleton store exposing:
- `PresetKey` union type: `'last7' | 'last14' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'`
- `DateRange` type: `{ from: Date; to: Date }`
- `getPresetRange(preset)` — exported pure function (testable without React)
- `useDateRangeStore` — default state `last30` (DASH-04); `setRange()` and `applyPreset()` actions; `applyPreset('custom')` is a no-op by design

### lib/dashboard-kpis.ts
Pure functions for all KPI mathematics:
- `aggregateRollups(rows)` — reduces `daily_rollups` rows into `AggregatedKpis`; derives ROAS/CPA/CTR with zero-guards; coerces inputs via `Number()`
- `calcDelta(current, prior)` — returns `{ absolute, pct: number | null }`; `pct` is `null` when `prior === 0` (DASH-01 Pitfall 7)
- `computePriorRange(from, to)` — same-duration prior period; `priorTo = from - 1 day`
- `computeChannelSplit(googleSpend, metaSpend)` — returns `{ google, meta }` with `value` and `pct`; both `pct = 0` when total is zero

### lib/campaign-aggregation.ts
Pure function for CAMP-01 aggregation without Postgres GROUP BY:
- `groupCampaignMetrics(rows)` — groups `campaign_metrics` rows by `campaign_id` using Map; sums metrics; derives CTR/CPA/ROAS with zero-guards; status determined by row with latest `date`; `convValue` field matches `type Campaign` from `lib/mock-data.ts` for drop-in use in the existing campaigns table

## Test Results

| Test File | Tests | Result |
|-----------|-------|--------|
| tests/unit/date-range-store.test.ts | 13 | PASS |
| tests/unit/dashboard-kpis.test.ts | 17 | PASS |
| tests/unit/channel-split.test.ts | 5 | PASS |
| tests/unit/campaign-aggregation.test.ts | 15 | PASS |
| **Total** | **50** | **ALL GREEN** |

Wave 0 requirement from VALIDATION.md fully satisfied.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 6f307e6 | feat(03-01): add formatters, date-range store and preset tests |
| Task 2 | 615c71b | feat(03-01): add dashboard KPI aggregation, delta, and channel split logic |
| Task 3 | a901014 | feat(03-01): add campaign metrics aggregation by campaign_id with tests |

## Decisions Made

1. **`calcDelta` returns `pct: null` when prior is zero** — matches RESEARCH.md Pitfall 7; UI must handle null to show `'—'` symbol instead of dividing by zero
2. **`groupCampaignMetrics` status from latest date** — lexicographic comparison of `YYYY-MM-DD` strings is safe and avoids Date parsing overhead
3. **All inputs coerced via `Number()`** — Supabase JS client may return PostgreSQL `numeric` columns as strings; coercion is applied at aggregation boundary
4. **Zustand store as module singleton** — no Provider wrapper; `create` from `zustand` v5 is sufficient for purely client-side in-memory state (RESEARCH.md Pattern 3)

## Deviations from Plan

None — plan executed exactly as written. All 4 modules created, all 4 test files green, no new dependencies installed (Zustand was already in package.json).

## Known Stubs

None. This plan creates pure logic modules with no UI rendering or data source wiring. No stubs exist.

## Threat Flags

None. All files in this plan are pure computation modules with no I/O, no network, no secrets, no trust boundaries (T-03-PURE-01: accept disposition confirmed).

## Self-Check: PASSED

Files exist:
- FOUND: lib/formatters.ts
- FOUND: lib/stores/date-range.ts
- FOUND: lib/dashboard-kpis.ts
- FOUND: lib/campaign-aggregation.ts
- FOUND: tests/unit/date-range-store.test.ts
- FOUND: tests/unit/dashboard-kpis.test.ts
- FOUND: tests/unit/channel-split.test.ts
- FOUND: tests/unit/campaign-aggregation.test.ts

Commits exist:
- FOUND: 6f307e6 (Task 1)
- FOUND: 615c71b (Task 2)
- FOUND: a901014 (Task 3)
