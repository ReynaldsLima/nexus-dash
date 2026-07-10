---
phase: 05-agencia-multi-cliente
plan: 05
subsystem: backend
tags: [server-actions, supabase, agency, zod, vitest]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 02
    provides: "agencies/agency_users/agency_tenants tables + RLS live in Supabase; types/database.types.ts regenerated with matching Row/Insert/Update shapes"
  - phase: 05-agencia-multi-cliente
    plan: 01
    provides: "tests/agencies.test.ts Wave 0 it.todo() scaffold — the exact describe blocks this plan fills in"
provides:
  - "lib/actions/agencies.ts — createAgency, deactivateAgency, reactivateAgency, createAgencyUser, grantTenant, revokeTenant Server Actions"
  - "tests/agencies.test.ts fully green, zero it.todo() — 12 passing mock-based assertions covering all 6 exports"
affects: [05-06-agency-tenant-management-ui, 05-07-agency-landing-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agency Server Actions mirror lib/actions/tenants.ts's established pattern exactly: Zod safeParse validation, createServiceClient() for service-role admin writes bypassing RLS, generateTempPassword() (16-char + 'Aa1!' suffix), revalidatePath() after mutation, discriminated-union return shapes ({ ok: true, ... } | { error })"
    - "grantTenant/revokeTenant use upsert(..., { onConflict: 'agency_id,tenant_id', ignoreDuplicates: true }) / delete().eq().eq() to make grant/revoke idempotent toggles rather than error on duplicate/missing rows"
    - "Test mock's insert() return value serves double duty: a .select().single() chain for agencies (which selects id after insert) and a directly-awaitable then() for agency_users (which is fire-and-forget insert, no select) — same generic from(table) factory handles both shapes"

key-files:
  created: []
  modified:
    - lib/actions/agencies.ts
    - tests/agencies.test.ts

key-decisions:
  - "Followed the plan's fully-specified implementation verbatim — column names (name/active, agency_id/tenant_id/user_id) already matched types/database.types.ts exactly (confirmed via Read before writing), no adaptation needed"
  - "createAgencyUser inserts exclusively into agency_users, never tenant_users (D-04) — verified by grep showing no .from('tenant_users') call in the file (only a code comment references the table name)"
  - "Test file's mock then() implementation extended slightly beyond the plan's sketch to properly forward resolve/reject through Promise.resolve(...).then(...) rather than calling resolve() directly — makes the thenable spec-compliant for await, avoiding subtle unhandled-rejection edge cases"

requirements-completed: [AGENCY-01, AGENCY-02]

# Metrics
duration: ~15min
completed: 2026-07-10
---

# Phase 05 Plan 05: Agency Server Actions Summary

**`lib/actions/agencies.ts` implements the six Super-Admin agency-management Server Actions (create/deactivate/reactivate agency, create agency user, grant/revoke tenant access) mirroring `lib/actions/tenants.ts`'s exact pattern, with `tests/agencies.test.ts` converted from Plan 01's `it.todo()` scaffold to 12 real, passing mock-based assertions.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-09T21:57Z (approx.)
- **Completed:** 2026-07-10T01:10Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `lib/actions/agencies.ts` with all 6 exports: `createAgency`, `deactivateAgency`, `reactivateAgency`, `createAgencyUser`, `grantTenant`, `revokeTenant`
- `createAgency` inserts into `agencies` (relies on DB `active` default `true`), returns `{ ok: true, agencyId }`
- `deactivateAgency`/`reactivateAgency` toggle `agencies.active` via a shared `setAgencyActive` helper — never delete the row
- `createAgencyUser` creates an `auth.users` row via `supabase.auth.admin.createUser`, then inserts into `agency_users` only (D-04 identity separation); rolls back (deletes) the auth user if the `agency_users` insert fails
- `grantTenant`/`revokeTenant` manage `agency_tenants` rows idempotently — `upsert(..., { ignoreDuplicates: true })` for grant, plain `delete().eq().eq()` for revoke (both no-op successfully on repeat calls)
- Filled `tests/agencies.test.ts` — replaced all `it.todo()` scaffolds with 12 real mock-based tests covering every exported function, including the rollback-on-insert-failure path for `createAgencyUser`
- Confirmed via grep: zero `.from('tenant_users')` calls in `lib/actions/agencies.ts` (D-04 satisfied)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement lib/actions/agencies.ts** - `17796b5` (feat)
2. **Task 2: Fill tests/agencies.test.ts with real mock-based assertions** - `5769c52` (test)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `lib/actions/agencies.ts` - all 6 Server Actions (createAgency, deactivateAgency, reactivateAgency, createAgencyUser, grantTenant, revokeTenant)
- `tests/agencies.test.ts` - 12 real mock-based tests, zero `it.todo()` remaining

## Decisions Made

- Implemented the plan's fully-specified code verbatim — column names in the plan's snippet already matched `types/database.types.ts` (`agencies.name`/`active`, `agency_tenants.agency_id`/`tenant_id`, `agency_users.agency_id`/`user_id`), confirmed by reading the generated types before writing any code
- Extended the test file's mock `then()` slightly beyond the plan's literal sketch (forwarding through `Promise.resolve(...).then(resolve, reject)` instead of calling `resolve()` directly) to make the mock's thenable behavior spec-compliant under `await`

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` blocks for both tasks contained complete, ready-to-use code; no adaptation, bug fixes, or missing-functionality additions were needed.

## Issues Encountered

- `npx tsc --noEmit` still reports only the same 2 pre-existing errors already logged in `deferred-items.md` (`tests/integration/vault-rpc.test.ts` lines 124, 135) — confirmed unrelated to this plan's files, left untouched per scope boundary.
- `npm run build` (Next.js 16.2.6, Turbopack) completes cleanly with no new warnings or errors.
- Full test suite (`npx vitest run`): 18 files, 143 passed / 1 skipped / 10 todo (unrelated todos elsewhere), no regressions.

## Next Phase Readiness

- `lib/actions/agencies.ts` is the complete interface contract Plan 06's UI (agency create/grant-management screen) will consume — all 6 functions exist, type-check, and are tested
- `createAgencyUser`'s D-04 guarantee (never touches `tenant_users`) is verified both by test assertion and static grep, ready for Plan 06/07 to build on top of without re-verifying this invariant

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: lib/actions/agencies.ts
- FOUND: tests/agencies.test.ts
- FOUND: .planning/phases/05-agencia-multi-cliente/05-05-SUMMARY.md
- FOUND: 17796b5 (Task 1 commit)
- FOUND: 5769c52 (Task 2 commit)
