---
phase: 10-gest-o-de-usu-rios
plan: 01
subsystem: auth
tags: [supabase, postgres, security-definer, rpc, server-actions, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    provides: agency_users/agency_tenants schema and lib/actions/agencies.ts Server Action patterns
  - phase: 01-foundation
    provides: public.get_user_role() JWT-claims helper (supabase/migrations/0003_create_helper_functions.sql)
provides:
  - "public.revoke_user_sessions(uuid) SECURITY DEFINER RPC, live, service_role-only"
  - "lib/actions/auth-guard.ts requireSuperAdmin() gate for all future Phase 10 Server Actions"
  - "Live integration test proving USER-05's session revocation actually works server-side"
  - "RED it.todo() scaffolds for tenant/agency user-management Server Actions (Plan 02 target)"
affects: [10-02, 10-03, 10-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER Postgres RPC restricted to service_role, called via createServiceClient().rpc() — used when the SDK has no method that can act on an arbitrary OTHER user's session"
    - "requireSuperAdmin() gate called at the top of every sensitive Server Action, using the user-session client (createClient) + rpc('get_user_role'), never the service client"

key-files:
  created:
    - supabase/migrations/0023_revoke_user_sessions_function.sql
    - lib/actions/auth-guard.ts
    - tests/integration/user-session-revocation.test.ts
    - tests/unit/tenant-user-management-actions.test.ts
    - tests/unit/agency-user-management-actions.test.ts
  modified: []

key-decisions:
  - "Confirmed live (pg_constraint) that auth.refresh_tokens has ON DELETE CASCADE FK to auth.sessions(id) via session_id — a single DELETE FROM auth.sessions fully revokes refresh capability, no second DELETE needed"
  - "Repaired pre-existing migration-history drift (remote had 0012 marked applied with no matching local file, blocking `supabase db push`) via `supabase migration repair --status reverted 0012` — bookkeeping-only, matches actual git history (file was deleted in Phase 8 Plan 02, though its columns remain live and orphaned on tenants)"

patterns-established:
  - "Session-revocation-by-user-id: new Postgres RPC, not supabase.auth.admin.signOut() (which needs the TARGET user's own JWT, never available to a Super Admin acting on someone else's account)"

requirements-completed: []  # USER-05 NOT yet complete — this plan built the revoke_user_sessions RPC foundation only; removeTenantUserAccess/removeAgencyUserAccess Server Actions (Plan 02) deliver the actual requirement

duration: ~16min
completed: 2026-07-12
---

# Phase 10 Plan 01: Session Revocation RPC + Super-Admin Guard Summary

**New SECURITY DEFINER `revoke_user_sessions(uuid)` Postgres RPC (pushed live, service_role-only), a shared `requireSuperAdmin()` Server Action gate, and Wave 0 RED test scaffolds for Phase 10's user-management actions — laid the foundation Plans 02-04 build on.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-12T13:50:00Z (approx.)
- **Completed:** 2026-07-12T13:56:21Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 created, 0 modified

## Accomplishments

- `public.revoke_user_sessions(uuid)` exists live on `rvkkvjitfddtbdpkupok`, `SECURITY DEFINER`, `REVOKE ALL FROM authenticated/anon/PUBLIC`, `GRANT EXECUTE TO service_role` only — verified via `pg_proc`/`has_function_privilege`
- A live integration test proves the RPC's actual effect: a real test user's pre-revocation `refresh_token` can no longer mint a new access token after `revoke_user_sessions` runs (`refreshSession` errors) — not just "the RPC was called without throwing"
- `lib/actions/auth-guard.ts`'s `requireSuperAdmin()` is now the single shared authorization gate every Phase 10 Server Action will call, using the user-session client (never the service client, which silently returns `NULL` from `get_user_role()`)
- Two RED `it.todo()` scaffolds (7 cases each) enumerate the exact tenant/agency Server Action behaviors Plan 02 must implement and turn green

## Task Commits

Each task was committed atomically:

1. **Task 1: Inspect auth schema, create revoke_user_sessions migration, push to live DB** - `0adc619` (feat)
2. **Task 2: Write live integration test proving revocation actually takes effect** - `406b5ce` (test)
3. **Task 3: Create requireSuperAdmin guard + RED unit-test scaffolds for both action files** - `cc2b944` (feat)

## Files Created/Modified

- `supabase/migrations/0023_revoke_user_sessions_function.sql` - `SECURITY DEFINER` RPC deleting `auth.sessions` rows by `user_id`; cascades to `auth.refresh_tokens` via a confirmed live FK
- `lib/actions/auth-guard.ts` - `requireSuperAdmin(): Promise<GuardResult>`, shared gate for all new Phase 10 Server Actions
- `tests/integration/user-session-revocation.test.ts` - skip-if-no-env live test; ran against the real project and passed (2/2), proving USER-05's revocation effect
- `tests/unit/tenant-user-management-actions.test.ts` - RED scaffold, 7 `it.todo()` cases for `editTenantUserEmail`/`resetTenantUserPassword`/`removeTenantUserAccess`
- `tests/unit/agency-user-management-actions.test.ts` - RED scaffold, 7 `it.todo()` cases for the agency-scoped mirror

## Decisions Made

- **Cascade FK confirmed, second DELETE line omitted:** Task 1's required schema inspection (`pg_constraint` query against `auth.refresh_tokens`) found `refresh_tokens_session_id_fkey: FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE` live. Per the plan's own instruction ("prefer keeping BOTH deletes if the cascade cannot be positively confirmed"), since it WAS positively confirmed, the migration uses only `DELETE FROM auth.sessions` — the commented-out second `DELETE FROM auth.refresh_tokens` line was not needed. This resolves 10-RESEARCH.md's Open Question 2 and Assumption A3 with a definitive "yes, cascade exists."
- **Migration-history repair (bookkeeping only, no schema change):** `supabase db push` failed with "Remote migration versions not found in local migrations directory" — the remote `supabase_migrations.schema_migrations` table had a row for version `0012` (`add_google_sheets_to_tenants`) with no matching local file. Investigation confirmed migration 0012's columns (`sheet_id`, `sheets_api_key`) DO exist live on `tenants` — meaning it genuinely was applied at some point, contradicting Phase 8 Plan 02's SUMMARY claim that "no schema-push/migration-apply command was run" for that file. Ran `supabase migration repair --status reverted 0012 --linked` (the CLI's own suggested recovery command) to bring the remote migration-history table back in sync with local git history (the file was deleted, untracked, in Phase 8 Plan 02) — this only edits the bookkeeping table, not the actual `tenants` columns, which remain live and orphaned exactly as Phase 8 left them. Documented here as a flag for the user/future cleanup; not fixed further as it's out of this plan's scope (Rule 3: unblocking the current task only, not resolving the underlying historical discrepancy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired migration-history drift blocking `supabase db push`**
- **Found during:** Task 1 (push migration 0023 to live DB)
- **Issue:** `supabase db push` failed immediately with "Remote migration versions not found in local migrations directory" — remote had migration `0012` marked applied with no corresponding local file (deleted in Phase 8 Plan 02, per that plan's own SUMMARY, though contrary to that SUMMARY's claim the columns were confirmed live)
- **Fix:** Ran `supabase migration repair --status reverted 0012 --linked` — the CLI's own literal suggested recovery command — to sync the remote migration-history bookkeeping table with local git state. No schema change; `tenants.sheet_id`/`sheets_api_key` columns remain live and untouched.
- **Files modified:** none (remote `supabase_migrations.schema_migrations` metadata table only)
- **Verification:** `supabase migration list --linked` showed Local/Remote in sync (both missing 0012, both showing 0023 pending) before `db push` was retried; push then succeeded
- **Committed in:** N/A (no local file changed; documented here and in the Task 1 commit message `0adc619`)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock the required `supabase db push` step. No scope creep — no schema was altered, and the underlying Phase 8 documentation discrepancy (0012 was actually applied despite that plan's SUMMARY claiming otherwise) is flagged here for visibility, not silently absorbed.

## Issues Encountered

None beyond the migration-history drift documented above (which blocked, then was resolved).

## User Setup Required

None - no external service configuration required. Migration 0023 is already live.

## Next Phase Readiness

- Plan 02 can now build `editTenantUserEmail`/`resetTenantUserPassword`/`removeTenantUserAccess` (and the agency mirrors) directly against this plan's two RED scaffolds, calling `requireSuperAdmin()` from `lib/actions/auth-guard.ts` and `createServiceClient().rpc('revoke_user_sessions', {...})` for USER-05's removal flow — both interfaces are live and integration-verified.
- No blockers carried forward. Migration 0023 is confirmed live and correct; the session-revocation mechanism's server-side effect is proven, not assumed.
- Flag for a future cleanup task (not this milestone): migration 0012's `tenants.sheet_id`/`sheets_api_key` columns are live but orphaned (superseded by Phase 03.1's `sheets_service_account` approach) — out of scope here, noted for whoever next touches `supabase/migrations/`.

---
*Phase: 10-gest-o-de-usu-rios*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 5 created files verified present on disk; all 3 task commits (`0adc619`, `406b5ce`, `cc2b944`) verified present in git history.
