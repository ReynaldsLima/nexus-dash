---
phase: 11-janela-de-hist-rico-retroativo
plan: 05
subsystem: n8n-sync
tags: [n8n, postgrest, backfill, google-ads, meta-ads]

# Dependency graph
requires:
  - phase: 11-janela-de-hist-rico-retroativo
    provides: "ad_accounts.backfill_days column (migration 0024, Plan 01)"
provides:
  - "Both N8N sync workflows (google-ads-sync.json, meta-ads-sync.json) fetch and honor per-account backfill_days on first sync, falling back to the global Set Constants.BACKFILL_DAYS"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nullish-coalescing fallback (`??`) inside an N8N Code node to prefer a per-row PostgREST-selected value over a global workflow constant"

key-files:
  created: []
  modified:
    - n8n-workflows/google-ads-sync.json
    - n8n-workflows/meta-ads-sync.json

key-decisions:
  - "INCREMENTAL_DAYS stays global (untouched) — only the first-sync (isFirstSync === true) branch became per-account, per the plan's explicit scope"

patterns-established:
  - "PostgREST select additions to List active … accounts nodes flow straight into Compute date range via $('Loop tenants').item.json.<field> — no new HTTP call needed since the field just rides along on the existing per-account row"

requirements-completed: [SET-04]

# Metrics
duration: 4min
completed: 2026-07-17
---

# Phase 11 Plan 05: N8N Sync Workflows Honor Per-Account Backfill Window Summary

**Both Google Ads and Meta Ads N8N sync workflows now select `backfill_days` from `ad_accounts` and use it (with global-constant fallback) for the first-sync date range window**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-17T23:20:14-03:00 (approx, immediately after Plan 04's final commit)
- **Completed:** 2026-07-17T23:24:31-03:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `n8n-workflows/google-ads-sync.json`: `List active Google Ads accounts` node's PostgREST select now includes `backfill_days`; `Compute date range`'s jsCode uses `$('Loop tenants').item.json.backfill_days ?? $('Set Constants').first().json.BACKFILL_DAYS` for the first-sync window
- `n8n-workflows/meta-ads-sync.json`: identical two edits applied — select gained `backfill_days`, `Compute date range` jsCode uses the same per-account-with-fallback expression; the Meta-specific `act_` prefix handling for `ad_account_id` was left untouched
- This closes the SET-04 loop: the window persisted per-tenant in `ad_accounts.backfill_days` (Plans 01-03) now actually drives what N8N pulls on an account's first sync, with rows predating the migration (or any null value) safely falling back to the global constant

## Task Commits

Each task was committed atomically:

1. **Task 1: google-ads-sync.json — select + use backfill_days** - `7339662`
2. **Task 2: meta-ads-sync.json — select + use backfill_days** - `82145a4`

## Files Created/Modified
- `n8n-workflows/google-ads-sync.json` - PostgREST select gained `backfill_days`; `Compute date range` jsCode's first-sync `days` assignment now reads the per-account value with a `??` fallback to the global `BACKFILL_DAYS` constant
- `n8n-workflows/meta-ads-sync.json` - same two edits; the pre-existing `act_` prefix handling for `ad_account_id` in the same jsCode string is unchanged

## Decisions Made
- No new decisions — plan executed exactly as specified, applying the same two-edit pattern to both workflow files

## Deviations from Plan

None - plan executed exactly as written. Both files remain valid JSON; `active: false` unchanged (user imports/activates manually); `INCREMENTAL_DAYS` behavior and the Meta `act_` handling are byte-for-byte unchanged aside from the targeted `days` assignment line.

## Issues Encountered
None.

## User Setup Required

None for this plan specifically. As with the rest of Phase 11's N8N workflow changes, the user still needs to re-import/re-activate the updated workflow JSON in the live N8N instance for the change to take effect in production — same standing external/ops step already tracked for the Google Ads Developer Token and Meta System User token activation in `.planning/OPS-FOLLOWUPS.md`.

## Next Phase Readiness
- SET-04 fully satisfied — Phase 11's SET-03/04/05 requirement set (backfill window: DB column, connect-time UI, N8N enforcement, post-connect edit) is now entirely code-complete
- Phase 11 is now 5/5 plans complete
- No blockers for Phase 12 (Redesign Visual)

---
*Phase: 11-janela-de-hist-rico-retroativo*
*Completed: 2026-07-17*

## Self-Check: PASSED

Both modified files confirmed present on disk with the expected content (`backfill_days` in both PostgREST selects and both `Compute date range` jsCode strings, `INCREMENTAL_DAYS` line unchanged, Meta `act_` handling intact); both task commit hashes (7339662, 82145a4) confirmed in git history via `git log --oneline`.
