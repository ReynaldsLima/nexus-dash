---
phase: 11-janela-de-hist-rico-retroativo
plan: 03
subsystem: settings
tags: [zod, react-hook-form, meta-ads, backfill, vitest]

# Dependency graph
requires:
  - phase: 11-janela-de-hist-rico-retroativo
    provides: "ad_accounts.backfill_days column + CHECK constraint (Plan 01)"
provides:
  - "Meta Ads connect route validates + persists backfill_days (7-365, default 90)"
  - "MetaAdsForm number input for backfill window, wired to POST body"
affects: [12-redesign-visual]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "z.input/z.output split for useForm generics when a Zod field uses z.coerce.number() (mirrors GoogleAdsForm from Plan 02)"

key-files:
  created:
    - tests/unit/meta-ads-connect-route.test.ts
  modified:
    - app/api/meta-ads/connect/route.ts
    - components/settings/meta-ads-form.tsx

key-decisions:
  - "Meta connect route uses z.number() (not z.coerce.number()) for backfillDays since Meta posts real JSON, unlike Google's OAuth query-string round trip"
  - "Test UUIDs must be RFC-4122-shaped (version nibble 1-8) — z.uuid() in Zod v4 rejects placeholder UUIDs like 00000000-0000-0000-..."

patterns-established: []

requirements-completed: [SET-03, SET-04]

# Metrics
duration: ~5min
completed: 2026-07-17
---

# Phase 11 Plan 03: Meta Ads Connect Backfill Window Summary

**Meta Ads connect route + form now carry a validated 7-365 day backfill window (default 90) straight through the single-POST JSON flow into the `ad_accounts` upsert.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-07-17T23:08:03Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `app/api/meta-ads/connect/route.ts`'s `BodySchema` now validates `backfillDays: z.number().int().min(7).max(365).default(90)` and the step-7 `ad_accounts` upsert includes `backfill_days: parsed.data.backfillDays`
- New focused unit spec (`tests/unit/meta-ads-connect-route.test.ts`, 3/3 passing) covers: custom value (45) reaching the upsert, the 90-day default on omission, and a 400 with zero upsert calls for an out-of-range value (3)
- `MetaAdsForm` gained a number input (7-365, default 90) mirroring `GoogleAdsForm`'s block exactly (same label, help text, error rendering), wired into the POST body and preserved on the post-success `reset()` call

## Task Commits

Each task was committed atomically:

1. **Task 1: Meta connect route validates + upserts backfill_days (with new spec)** - `24f1a23` (feat)
2. **Task 2: Add backfill window input to MetaAdsForm** - `6bbbaa1` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `app/api/meta-ads/connect/route.ts` - Added `backfillDays` to `BodySchema` (real `z.number()`, not coerced) and to the `ad_accounts` upsert payload
- `components/settings/meta-ads-form.tsx` - Added `backfillDays` to `MetaAdsSchema` (`z.coerce.number()`), a new number-input field block, and wired the value into the POST body + success-path `reset()`
- `tests/unit/meta-ads-connect-route.test.ts` - New unit spec (mirrors `tests/unit/google-ads-callback-route.test.ts`'s mock scaffold) asserting `backfill_days` flows correctly through validation and the upsert

## Decisions Made
- Meta's route validates `backfillDays` as a real `z.number()` (not `z.coerce.number()`) because the client sends actual JSON (`fetch` with `JSON.stringify`), unlike Google Ads' OAuth query-string redirect where every value arrives as a string — this was already specified in the plan and confirmed correct by the passing test suite.
- The client-side `MetaAdsSchema` still uses `z.coerce.number()` (HTML `<input type="number">` always yields a string in `defaultValues`/registered state) — this required the same `z.input`/`z.output` generic split for `useForm` that `GoogleAdsForm` established in Plan 02, applied here for consistency.

## Deviations from Plan

None - plan executed exactly as written. One incidental fix: the plan's suggested test used a numerically simple placeholder tenantId; encountered Zod v4's `z.uuid()` rejecting non-RFC-4122-shaped values (version nibble must be 1-8) during test authoring, and the test was written directly with a valid v4-shaped UUID (`00000000-0000-4000-8000-000000000001`) rather than needing a fix-and-retry cycle — not counted as a plan deviation since it never touched production code.

## Issues Encountered
None beyond the UUID format note above (resolved during initial test authoring, not a retroactive fix).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both Google Ads (Plan 02) and Meta Ads (Plan 03) connect flows now persist `backfill_days` — SET-03/SET-04 fully satisfied for both channels.
- Remaining Phase 11 plans (04, 05 per ROADMAP) can proceed; no blockers introduced by this plan.

---
*Phase: 11-janela-de-hist-rico-retroativo*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: app/api/meta-ads/connect/route.ts
- FOUND: components/settings/meta-ads-form.tsx
- FOUND: tests/unit/meta-ads-connect-route.test.ts
- FOUND: commit 24f1a23
- FOUND: commit 6bbbaa1
