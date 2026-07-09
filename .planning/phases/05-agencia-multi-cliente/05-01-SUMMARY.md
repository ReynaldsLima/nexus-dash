---
phase: 05-agencia-multi-cliente
plan: 01
subsystem: testing
tags: [vitest, test-scaffolding, rls, server-actions, agency]

# Dependency graph
requires:
  - phase: 03.1-leads-management-via-google-sheets-integration
    provides: "tests/rls.test.ts and tests/tenants.test.ts patterns (skip-if-no-env RLS suites, mock-based Server Action suites) reused as the exact templates for this plan's scaffolds"
provides:
  - "tests/agency-rls.test.ts — Wave 0 scaffold for AGENCY-06 (agency-scoped RLS) and AGENCY-03/04 (agency tenant list resolution)"
  - "tests/integration/tenant-role-migration.test.ts — Wave 0 scaffold for AGENCY-07 (tenant_users.role collapse)"
  - "tests/agencies.test.ts — Wave 0 scaffold for AGENCY-01/02 (lib/actions/agencies.ts Server Actions)"
  - "tests/unit/leads-status-route.test.ts extended with 5 it.todo() cases for AGENCY-08 (cross-tenant/agency IDOR gate)"
affects: [05-02-agency-data-layer, 05-03-cliente-role-collapse, 05-05-agency-actions, 05-08-leads-scope-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 test scaffolding: it.todo() placeholders + skip-if-no-env describeIfEnv wrapper for integration suites, filled in by the plan that implements the corresponding feature"

key-files:
  created:
    - tests/agency-rls.test.ts
    - tests/integration/tenant-role-migration.test.ts
    - tests/agencies.test.ts
  modified:
    - tests/unit/leads-status-route.test.ts

key-decisions:
  - "Replicated tests/rls.test.ts's exact hasTestEnv/describeIfEnv skip pattern for both new integration suites — no new env var names introduced"
  - "Replicated tests/tenants.test.ts's mock-based approach for tests/agencies.test.ts, but left as pure it.todo() since lib/actions/agencies.ts does not exist yet (Plan 05 implements it)"
  - "Appended AGENCY-08 todos to the end of leads-status-route.test.ts rather than restructuring — all 9 pre-existing tests untouched"

patterns-established:
  - "Wave 0 scaffold discovery: downstream plans (02, 03, 05, 08) each own filling in one of these four files' it.todo() cases as their verification target"

requirements-completed: [AGENCY-06, AGENCY-07, AGENCY-01, AGENCY-02, AGENCY-08]

# Metrics
duration: 12min
completed: 2026-07-09
---

# Phase 05 Plan 01: Wave 0 Test Infrastructure Summary

**Four Vitest scaffold files (3 new, 1 extended) with 27 `it.todo()` placeholders covering AGENCY-01/02/06/07/08 — zero real assertions yet, full suite exits 0 with 121 passing + 32 todo.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-09T18:52:00Z
- **Completed:** 2026-07-09T19:04:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `tests/agency-rls.test.ts` — skip-if-no-env integration scaffold for AGENCY-06 (agency-scoped RLS via `agency_tenants`) and AGENCY-03/04 (agency tenant list resolution)
- Created `tests/integration/tenant-role-migration.test.ts` — skip-if-no-env integration scaffold for AGENCY-07 (`tenant_users.role` collapse to `tenant_admin`)
- Created `tests/agencies.test.ts` — mock-pattern scaffold for AGENCY-01/02 (`lib/actions/agencies.ts` Server Actions: createAgency, deactivate/reactivate, createAgencyUser, grantTenant/revokeTenant)
- Extended `tests/unit/leads-status-route.test.ts` with 5 `it.todo()` cases for AGENCY-08 (cross-tenant/agency IDOR scope enforcement on `PATCH /api/leads/[id]/status`), all 9 pre-existing tests untouched and passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold agency-rls.test.ts and tenant-role-migration.test.ts** - `db88b92` (test)
2. **Task 2: Scaffold agencies.test.ts and extend leads-status-route.test.ts** - `4e66027` (test)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `tests/agency-rls.test.ts` - Wave 0 scaffold, AGENCY-06/03/04, 8 tests (7 todo + 1 sanity), skips without `SUPABASE_TEST_URL`
- `tests/integration/tenant-role-migration.test.ts` - Wave 0 scaffold, AGENCY-07, 5 tests (4 todo + 1 sanity), skips without `SUPABASE_TEST_URL`
- `tests/agencies.test.ts` - Wave 0 scaffold, AGENCY-01/02, 12 tests (11 todo + 1 sanity), mock-based (no network)
- `tests/unit/leads-status-route.test.ts` - Extended with 5 new `it.todo()` cases for AGENCY-08, existing 9 tests unmodified

## Decisions Made
- Reused `tests/rls.test.ts`'s exact `hasTestEnv`/`describeIfEnv` skip-if-no-env pattern verbatim for both new integration test files — no new environment variable names introduced, consistent with Phase 1's established convention
- `tests/agencies.test.ts` deliberately contains zero real mock wiring (unlike `tests/tenants.test.ts` which it mirrors structurally) because `lib/actions/agencies.ts` does not exist yet — Plan 05 will add both the implementation and the real assertions
- AGENCY-08 cases appended at the end of `leads-status-route.test.ts` as a new `describe` block rather than interleaved with existing tests, per the plan's explicit instruction to not modify any existing `it()`

## Deviations from Plan

**1. [Documentation correctness] Did NOT mark AGENCY-01/02/06/07/08 complete in REQUIREMENTS.md**
- **Found during:** State updates (after all tasks committed)
- **Issue:** This plan's frontmatter lists `requirements: [AGENCY-06, AGENCY-07, AGENCY-01, AGENCY-02, AGENCY-08]`, and the standard executor protocol calls for running `requirements mark-complete` on all frontmatter IDs. However, `.planning/REQUIREMENTS.md`'s own Traceability table maps each of these IDs to the plan that actually *implements* the feature (AGENCY-01/02 → 05-05/05-06, AGENCY-06 → 05-02, AGENCY-07 → 05-03, AGENCY-08 → 05-08) — none of which have executed yet. Plan 05-01 only adds `it.todo()` test scaffolds; no Server Action, RLS policy, or route logic was written. Running `mark-complete` would have flipped these five checkboxes to `[x]` while the underlying features remain unbuilt, corrupting REQUIREMENTS.md's accuracy.
- **Fix:** Ran `requirements mark-complete` once (per protocol), observed the incorrect result via `git diff`, then reverted `.planning/REQUIREMENTS.md` with `git checkout --`. Requirement checkboxes remain `[ ]` (Pending) and will be marked complete by the actual implementing plan (05-02, 05-03, 05-05/06, 05-08 respectively) when each lands.
- **Files modified:** none (change was reverted before commit)
- **Verification:** `git diff .planning/REQUIREMENTS.md` confirms no net change
- **Committed in:** N/A (reverted, not committed)

## Issues Encountered

- `npx tsc --noEmit` reports 4 pre-existing type errors in `tests/integration/vault-rpc.test.ts` (2) and `tests/tenants.test.ts` (2) — confirmed via grep that none of these errors are in this plan's created/modified files. Out of scope per the deviation rules' scope boundary (pre-existing failures in unrelated files). Logged to `.planning/phases/05-agencia-multi-cliente/deferred-items.md` for a future quick-fix task, since the stale `@ts-expect-error` in `tests/tenants.test.ts` may mask a real regression once Plan 03's role-collapse migration lands.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wave 0 test infrastructure complete: `05-VALIDATION.md`'s `nyquist_compliant` gate can now flip to `true`
- Plan 02 (agency data layer) has its verification target ready in `tests/agency-rls.test.ts`
- Plan 03 (Cliente role collapse) has its verification target ready in `tests/integration/tenant-role-migration.test.ts`
- Plan 05 (agency Server Actions) has its verification target ready in `tests/agencies.test.ts`
- Plan 08 (leads scope enforcement) has its verification target ready in the extended `tests/unit/leads-status-route.test.ts`
- No blockers for downstream Phase 5 plans

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: tests/agency-rls.test.ts
- FOUND: tests/integration/tenant-role-migration.test.ts
- FOUND: tests/agencies.test.ts
- FOUND: .planning/phases/05-agencia-multi-cliente/05-01-SUMMARY.md
- FOUND: db88b92 (Task 1 commit)
- FOUND: 4e66027 (Task 2 commit)
