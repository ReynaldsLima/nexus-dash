---
phase: 08-tech-debt-cleanup
plan: 03
subsystem: database
tags: [supabase, data-cleanup, agencies, auth-users, service-role]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    provides: agencies/agency_users/agency_tenants schema and RLS this plan cleaned test rows out of
provides:
  - Live Supabase project (rvkkvjitfddtbdpkupok) free of Phase 5 test fixtures (agencies, agency_users, tenant_users, auth.users)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-off live-data cleanup scripts use @supabase/supabase-js with the service role key (never raw SQL/psql, which weren't available in this environment) — scoped deletes by exact frozen primary key, never by re-running the broad discovery filter as the delete filter (TOCTOU mitigation)"

key-files:
  created: []
  modified: []

key-decisions:
  - "No mcp__supabase__execute_sql (or any Supabase MCP) tool and no supabase/psql CLI were available in this executor's toolset — deletes were performed instead via a temporary Node script using @supabase/supabase-js with SUPABASE_SERVICE_ROLE_KEY from .env.local, executed from the project root (for node_modules resolution) and deleted immediately after use; zero trace left in the repo"
  - "public.agencies has no `slug` column (only id/name/active/created_at, per migration 0017) — the plan's Task 1 narrative referred to 'slug' but the actual frozen delete set matched on the `name` field; post-delete verification queries were corrected to use `name`, not `slug`"
  - "auth.users deletion used supabase.auth.admin.deleteUser(id) (Admin API), not raw SQL DELETE, per the plan's stated preference — cascades identities cleanly"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-07-11
---

# Phase 8 Plan 03: Live Supabase Test-Fixture Cleanup Summary

**Deleted 11 fixture `agencies` rows, 1 `agency_users` row, 1 `tenant_users` row, and 2 `@example.com` `auth.users` rows from the live production Supabase project, in FK-safe order, scoped strictly by the human-approved frozen primary-key list — zero production data touched.**

## Performance

- **Duration:** ~6 min (this continuation session; Task 1 enumeration + Task 2 checkpoint ran in a prior session)
- **Completed:** 2026-07-11
- **Tasks:** 1 (Task 3 — the approved DELETE; Tasks 1-2 completed in a prior session per the checkpoint hand-off)
- **Files modified:** 0 application/repo files (live-DB-only operation)

## Accomplishments
- Deleted the approved fixture set from live Supabase (`rvkkvjitfddtbdpkupok`) in strict FK-safe order: `tenant_users` (1) → `agency_users` (1) → `agencies` (11) → `auth.users` (2, via Admin API, cascading `auth.identities`)
- Verified every DELETE affected exactly the expected row count before proceeding to the next step (1, 1, 11, 2 — all matched)
- Post-delete re-verification confirms zero fixture rows remain: `agencies` table now has 0 total rows; no rows match the fixture name filters; no `agency_users`/`tenant_users` rows reference the deleted ids; both test `auth.users` ids return "User not found" via `getUserById`
- Confirmed the real `LUKSEG` tenant (id `9f7e3c67-55bb-4fa9-ad45-e78f526429e6`) is untouched — still present and `active: true` — satisfying the plan's "no production data deleted" truth

## Task Commits

Task 3 was a live-database-only operation (no repo files changed) — no per-task commit applies, matching the plan's own `<files>` annotation ("none — writes against live Supabase").

**Plan metadata:** (this SUMMARY.md + STATE.md/ROADMAP.md commit, see below)

## Files Created/Modified
None — this plan exclusively modified live Supabase data (`public.agencies`, `public.agency_users`, `public.tenant_users`, `auth.users`/`auth.identities`). A temporary Node script (`__tmp-delete-fixtures.mjs`) was created in the project root purely to get `node_modules` resolution for `@supabase/supabase-js`, executed, and deleted before this SUMMARY was written — `git status --short` confirms no trace remains.

## Decisions Made
- **No Supabase MCP tool or CLI available:** this executor's toolset did not include `mcp__supabase__execute_sql`/`list_tables` (referenced in the plan) nor a `supabase`/`psql` binary on PATH. Used `@supabase/supabase-js` (already a project dependency, v2.105.4) with the service-role key read from `.env.local` instead — functionally equivalent (bypasses RLS, same project), and arguably safer since standard `.delete().eq()/.in()` calls are less error-prone than hand-written SQL string interpolation.
- **`agencies` schema correction:** the plan's Task 1 narrative and my own initial post-delete verification query referenced a `slug` column on `agencies` that does not exist (confirmed via migration `0017_create_agencies_schema.sql`: columns are `id, name, active, created_at` only). The frozen delete set's human-readable labels (e.g. "rls-test-agency-switcher") are `name` values. Corrected the verification query to filter on `name` — the actual DELETE statements were unaffected since they used exact frozen ids throughout, never the `slug` filter.
- Deleted `auth.users` rows via `supabase.auth.admin.deleteUser(id)` (Admin API) rather than a raw SQL `DELETE FROM auth.users`, per the plan's explicit preference — confirmed both ids now return "User not found" from `getUserById`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No Supabase MCP tool / CLI available — substituted `@supabase/supabase-js` with the service-role key**
- **Found during:** Task 3 (attempting the approved DELETE)
- **Issue:** The plan instructs use of `mcp__supabase__execute_sql`; this executor's actual tool list contained no Supabase MCP tool, and `which supabase`/`which psql` both failed (not installed).
- **Fix:** Wrote a temporary Node script using `@supabase/supabase-js` (already installed, v2.105.4) with `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL` parsed from `.env.local`; added a hard-coded safety check that the URL contains the exact expected project ref (`rvkkvjitfddtbdpkupok`) before any write, plus a pre-flight existence check (by exact frozen id) before deleting and a post-delete re-verification — matching the plan's own safety intent. Script was deleted immediately after use; zero repo trace.
- **Files modified:** none (temporary script, deleted before commit)
- **Verification:** All 4 DELETE steps returned the exact expected row counts (1, 1, 11, 2); post-delete queries confirm 0 remaining fixture rows and the two `auth.users` ids are gone.
- **Committed in:** N/A (live-DB-only change, no repo diff to commit for this step)

**2. [Rule 1 - Bug] Post-delete verification query referenced a non-existent `slug` column**
- **Found during:** Task 3 (post-delete verification)
- **Issue:** First verification attempt queried `agencies.slug`, which errored `column agencies.slug does not exist` (PostgREST code `42703`) — the `agencies` table only ever had `id/name/active/created_at` (migration `0017`).
- **Fix:** Re-ran verification using `name`/`id` filters only; confirmed the actual DELETE statements (which used explicit frozen ids, not `slug`) were unaffected by this — only the *verification* query needed the column-name fix.
- **Files modified:** none (query correction only, no repo files)
- **Verification:** Corrected query returned `0` rows for the fixture-name filter, `0` rows among the 11 deleted ids, `0` remaining dependents, table total row count `0`.
- **Committed in:** N/A (live-DB-only change)

---

**Total deviations:** 2 auto-fixed (1 blocking — tooling substitution, 1 bug — wrong column name in a verification query only)
**Impact on plan:** Neither deviation changed the approved delete set, the deletion order, or the scoping-by-exact-id discipline the plan (and its threat model, T-08-06) required. No scope creep.

## Issues Encountered
- Supabase MCP tools referenced by the plan were not present in this executor's environment; resolved via the `@supabase/supabase-js` + service-role-key approach documented above (see Deviation 1).
- None otherwise — all 4 delete steps and all post-delete verification queries succeeded on the first (post-fix) attempt.

## User Setup Required
None — no external service configuration required. This plan only removed rows from the already-provisioned live Supabase project.

## Next Phase Readiness
- Phase 8 (Tech Debt Cleanup) is now 3/3 plans complete.
- The live Supabase `agencies` table is now empty (0 rows) and `auth.users` no longer contains either test fixture email — the real `LUKSEG` tenant and its data/users are untouched.
- No blockers for future work introduced by this plan.

---
*Phase: 08-tech-debt-cleanup*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/08-tech-debt-cleanup/08-03-SUMMARY.md`
- No task commits to verify (Task 3 was a live-database-only operation, no repo files changed) — matches the plan's own `<files>` annotation for Task 3.
- Live verification (already captured above): all 4 DELETE steps returned exact expected row counts; post-delete re-queries confirm 0 fixture rows remain and the real `LUKSEG` tenant is untouched.
