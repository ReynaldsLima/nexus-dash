---
phase: quick
plan: 260802-wde
subsystem: leads
tags: [sorting, vitest, tdd]

# Dependency graph
requires:
  - phase: quick-260802-w2g
    provides: compareByCriadoEm / sortLeadsByCriadoEmDesc chronological sort (replacing alphabetical sort)
provides:
  - "compareByCriadoEm with an id-based tiebreak for leads sharing the exact same criado_em timestamp"
affects: [leads-listing, leads-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared comparator (compareByCriadoEm) drives both the default API sort (sortLeadsByCriadoEmDesc) and the table's asc/desc toggle — fixes propagate to both consumers without touching them"

key-files:
  created: []
  modified:
    - lib/leads.ts
    - tests/unit/leads-sort.test.ts

key-decisions:
  - "Tiebreak by id follows the same direction as the date comparison (asc ? a.id-b.id : b.id-a.id), so the table's asc/desc header toggle inverts the tiebreak consistently with the date ordering"
  - "The null/null tiebreak (both leads have unparseable dates) also uses the id tiebreak, for behavioral consistency with the dated case — this changed one pre-existing test's expected output (SemData1/SemData2 order), done deliberately per the plan's decision_note"

patterns-established: []

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-08-02
---

# Quick Task 260802-wde: Corrigir desempate na ordenação de leads Summary

**Fixed `compareByCriadoEm` to tiebreak same-date leads by `id` (direction-aware), so leads created on the same day now sort most-recently-added-first in the default view instead of falling back to stable-sort insertion order**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-02T23:19:00-03:00 (approx)
- **Completed:** 2026-08-02T23:24:12-03:00
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- `compareByCriadoEm` now tiebreaks leads with the exact same parsed `criado_em` timestamp by `id`, respecting the `asc` direction passed in — desc shows highest `id` (most recently added row) first, asc shows lowest `id` first
- Leads with unparseable dates (both `null`) now follow the same tiebreak rule as dated leads, instead of falling back to array insertion order
- Chronological ordering across different dates is unaffected — the tiebreak only fires when `ta === tb`
- Both consumers (`sortLeadsByCriadoEmDesc` used by `GET /api/leads`, and the `app/[tenant-slug]/leads/page.tsx` table's asc/desc toggle) inherit the fix automatically since they share the one comparator — neither file was touched

## Task Commits

Each task was committed atomically (TDD flow):

1. **Task 1: RED — cobrir o desempate por id em tests/unit/leads-sort.test.ts** - `e05d5a4` (test)
2. **Task 2: GREEN — desempate por id em compareByCriadoEm** - `e08ae3a` (fix)

_Plan metadata commit (SUMMARY.md/STATE.md) is applied separately by the orchestrator, not by this executor._

## Files Created/Modified
- `lib/leads.ts` - `compareByCriadoEm` now computes an `id`-based tiebreak up front and returns it when dates are equal (including both-null), instead of returning `0`/falling through to stable-sort order
- `tests/unit/leads-sort.test.ts` - added 4 new `compareByCriadoEm` cases (desc tiebreak, asc tiebreak, date-takes-precedence, null/null tiebreak) and 2 new `sortLeadsByCriadoEmDesc` cases (same-day ordering, mixed-day ordering with per-day tiebreak); updated the pre-existing null-date test's expected order and renamed it to reflect the new rule

## Decisions Made
- Tiebreak direction mirrors `asc` so the single shared comparator stays coherent for both the API's fixed `desc` default and the table's user-toggled direction (documented in code comment above `compareByCriadoEm`)
- Applied the id tiebreak to the null/null case too (not just dated leads) for rule consistency — this was called out explicitly in the plan's `<decision_note>` as an intentional, non-obvious change to one pre-existing test

## Deviations from Plan

None - plan executed exactly as written. All 4 constraints (id never reassigned, null-goes-to-end guards unchanged and evaluated before the tiebreak, chronological order never overridden by id, no route/page files touched) were followed as specified in `<action>`.

## Issues Encountered
None. Task 1 produced the expected RED state: 6 of the 7 asserted new/changed cases failed against the old implementation (the "date takes precedence over id" case coincidentally already passed under the old code, since it never required date equality); all pre-existing `parseLeadDate`, id-preservation, and immutability tests stayed green throughout, confirming no scope leakage into unrelated behavior. Task 2's implementation turned all 19 tests in the file green (RED → GREEN), and the full suite (`npm test`, 36 files / 306 tests) stayed green with zero regressions.

`npx tsc --noEmit` reports 2 pre-existing errors in `tests/integration/vault-rpc.test.ts` (unrelated Supabase RPC typing issue) — confirmed via `git stash` that these predate this plan's changes and are out of scope per the deviation rules' scope boundary; not modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The tiebreak fix is fully covered by automated tests and self-contained to `lib/leads.ts`. Manual UI verification (steps 5-7 in the plan's `<verification>` section — visually confirming the reordered group in `/[tenant-slug]/leads`, the asc/desc toggle inversion, and that editing a mid-group lead's status still writes to the correct sheet row) is recommended as a follow-up but was not performed as part of this automated execution; no blockers for downstream work.

---
*Phase: quick*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: lib/leads.ts
- FOUND: tests/unit/leads-sort.test.ts
- FOUND commit: e05d5a4
- FOUND commit: e08ae3a
