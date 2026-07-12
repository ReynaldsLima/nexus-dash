---
phase: 10-gest-o-de-usu-rios
plan: 02
subsystem: auth
tags: [supabase, server-actions, vitest, tdd, zod]

# Dependency graph
requires:
  - phase: 10-gest-o-de-usu-rios
    plan: 01
    provides: requireSuperAdmin() gate, revoke_user_sessions RPC, RED test scaffolds
provides:
  - "editTenantUserEmail / resetTenantUserPassword / removeTenantUserAccess Server Actions (lib/actions/tenants.ts)"
  - "editAgencyUserEmail / resetAgencyUserPassword / removeAgencyUserAccess Server Actions (lib/actions/agencies.ts)"
  - "UserActionResult / ResetPasswordResult exported types (canonical source: lib/actions/tenants.ts)"
affects: [10-03, 10-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action gate-then-validate-then-act order: requireSuperAdmin() first, then Zod safeParse, then the privileged call — consistent across all 6 new actions"
    - "Doubly-scoped delete (BOTH join-table keys) before calling revoke_user_sessions, erroring out before the RPC call if the delete fails"

key-files:
  created: []
  modified:
    - lib/actions/tenants.ts
    - lib/actions/agencies.ts
    - tests/unit/tenant-user-management-actions.test.ts
    - tests/unit/agency-user-management-actions.test.ts
    - types/database.types.ts

key-decisions:
  - "Agency file imports UserActionResult/ResetPasswordResult from lib/actions/tenants.ts rather than redeclaring — single source of truth, per plan's explicit instruction"
  - "removeTenantUserAccess/removeAgencyUserAccess return { error } if the revoke_user_sessions RPC itself errors (not specified verbatim in the plan's behavior prose, but the natural extension of 'never silently swallow a privileged-call error' — consistent with every other error branch in both files)"

patterns-established: []

requirements-completed: [USER-03, USER-04, USER-05]

duration: ~16min
completed: 2026-07-12
---

# Phase 10 Plan 02: Tenant/Agency User-Management Server Actions Summary

**Six Super-Admin Server Actions (edit email, reset password, remove access — tenant and agency scoped) wired to `requireSuperAdmin()` and `revoke_user_sessions`, turning Plan 01's RED unit scaffolds GREEN.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-12T14:00:00Z (approx.)
- **Completed:** 2026-07-12T14:15:00Z (approx.)
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 action files, 2 test files, 1 generated-types file)

## Accomplishments

- `lib/actions/tenants.ts` now exports `editTenantUserEmail`, `resetTenantUserPassword`, `removeTenantUserAccess` — each starts with `requireSuperAdmin()` then Zod validation
- `lib/actions/agencies.ts` mirrors the tenant actions exactly for `agency_users`/`agencies`, reusing the tenant file's result types
- Both `removeTenant/AgencyUserAccess` actions delete the join row scoped by BOTH foreign keys (never a single-key delete that could touch the wrong tenant's/agency's membership) and then call `revoke_user_sessions` RPC — closing USER-05's actual revocation requirement
- Both unit test files (`tenant-user-management-actions.test.ts`, `agency-user-management-actions.test.ts`) converted from Plan 01's 7-case `it.todo()` scaffolds to real, passing assertions (8/8 each, including the sanity check)
- Full suite: 32 test files, 248 passed / 1 skipped / 5 todo — zero regressions beyond the documented pre-existing `anomaly_alerts` realtime websocket cold-start flake (reconfirmed non-regression via isolated re-run, 7/7 passed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Tenant user-management actions + fill tenant unit tests** - `719352d` (feat)
2. **Task 2: Agency user-management actions + fill agency unit tests** - `a813903` (feat)

## Files Created/Modified

- `lib/actions/tenants.ts` - added `editTenantUserEmail`, `resetTenantUserPassword`, `removeTenantUserAccess`, their Zod schemas, and the `UserActionResult`/`ResetPasswordResult` exported types
- `lib/actions/agencies.ts` - added `editAgencyUserEmail`, `resetAgencyUserPassword`, `removeAgencyUserAccess` mirroring the tenant actions, importing the shared result types
- `tests/unit/tenant-user-management-actions.test.ts` - 7 `it.todo()` cases filled with real assertions against the new actions (8/8 passing)
- `tests/unit/agency-user-management-actions.test.ts` - same, agency-scoped (8/8 passing)
- `types/database.types.ts` - regenerated via `supabase gen types typescript --project-id rvkkvjitfddtbdpkupok`, adding the `revoke_user_sessions` RPC signature that Plan 01's live migration 0023 introduced but never propagated into the generated types file (see Deviations)

## Decisions Made

- **Agency file imports result types instead of redeclaring:** `lib/actions/agencies.ts` does `import type { UserActionResult, ResetPasswordResult } from '@/lib/actions/tenants'` rather than defining its own duplicate types — per the plan's explicit instruction, keeps a single canonical shape for both call sites.
- **RPC error on remove-access actions returns `{ error }`:** the plan's prose only specified "if the delete errors, return `{ error }` WITHOUT calling the RPC" — it did not specify RPC-failure handling. Implemented `removeTenant/AgencyUserAccess` to also return `{ error: rpcError.message }` if `revoke_user_sessions` itself errors, rather than silently reporting `{ ok: true }` on a partial failure (join row deleted but sessions not revoked). Consistent with the rest of both files' error-handling convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated `types/database.types.ts` to include `revoke_user_sessions`**
- **Found during:** Task 1's `npx tsc --noEmit` verification step
- **Issue:** Plan 01's migration `0023_revoke_user_sessions_function.sql` was pushed live to the Supabase project, but the generated TypeScript types file (`types/database.types.ts`) was never regenerated afterward — its `Functions` map only listed the 7 pre-existing RPCs. Calling `supabase.rpc('revoke_user_sessions', ...)` from `lib/actions/tenants.ts` failed `tsc --noEmit` with `Argument of type '"revoke_user_sessions"' is not assignable to parameter of type '"create_or_update_vault_secret" | ... '`.
- **Fix:** Ran `npx supabase gen types typescript --project-id rvkkvjitfddtbdpkupok` against the live linked project and diffed the output against the current file — the only difference was the new `revoke_user_sessions: { Args: { target_user_id: string }; Returns: undefined }` entry. Applied that single addition (kept the same key ordering as the CLI's own generated output for cleanliness).
- **Files modified:** `types/database.types.ts`
- **Verification:** `diff types/database.types.ts <(npx supabase gen types typescript --project-id rvkkvjitfddtbdpkupok)` returns clean (exit 0) after the fix; `npx tsc --noEmit` now shows only the 2 pre-existing, unrelated `vault-rpc.test.ts` errors.
- **Committed in:** `719352d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock the plan's own `npx tsc --noEmit` acceptance criterion. No application behavior changed — this closes a documentation/tooling gap left over from Plan 01 (which pushed the migration but did not regenerate types), not a defect introduced by this plan's own code.

## Issues Encountered

- Initial test UUID fixtures (`11111111-1111-1111-1111-111111111111`-style, using `1`/`2` in every position) failed Zod v4's stricter `.uuid()` format check, which requires the version nibble to be `1-8` and the variant nibble to be `8/9/a/b`. Replaced with schema-valid v4-format UUIDs (e.g. `11111111-1111-4111-8111-111111111111`) in both test files — not a deviation from the plan, just a fixture-correctness fix caught immediately by the first test run.
- The pre-existing `anomaly_alerts` realtime websocket cold-start flake (documented since Phase 4 Plan 02, reconfirmed non-regression in every plan since) reappeared on the combined `npm test` run; isolated re-run of `tests/unit/anomaly-alerts-schema.test.ts` passed 7/7, confirming it is unrelated to this plan's changes.

## User Setup Required

None — no external service configuration required. All changes are code + a types-file regeneration against the already-live migration.

## Next Phase Readiness

- Plan 03 (UI wiring) can now call all 6 actions directly: `editTenant/AgencyUserEmail`, `resetTenant/AgencyUserPassword`, `removeTenant/AgencyUserAccess` — signatures match the plan's `<interfaces>` block exactly.
- Plan 04's manual verification of D-05 (whether an existing session survives a password reset) remains open, as intentionally scoped — both `resetTenant/AgencyUserPassword` actions carry the D-05 code comment flagging this.
- No blockers carried forward.

---
*Phase: 10-gest-o-de-usu-rios*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 4 modified/created files verified present on disk (`lib/actions/tenants.ts`, `lib/actions/agencies.ts`, `tests/unit/tenant-user-management-actions.test.ts`, `tests/unit/agency-user-management-actions.test.ts`); both task commits (`719352d`, `a813903`) verified present in git history.
