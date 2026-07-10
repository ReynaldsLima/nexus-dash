---
phase: 05-agencia-multi-cliente
plan: 03
subsystem: database
tags: [supabase, migrations, rls, zod, server-actions, react]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 02
    provides: "Live agencies/agency_users/agency_tenants schema + Auth Hook wiring fix (already resolved separately) that this plan's tenant_users role change builds alongside"
provides:
  - "tenant_users.role CHECK-constrained to the single value 'tenant_admin' — 'viewer' no longer a legal value, live in Supabase (rvkkvjitfddtbdpkupok)"
  - "createTenantUser Server Action simplified — no role parameter, always inserts role: 'tenant_admin'"
  - "Add-user dialog (components/tenants/add-user-modal.tsx) simplified — no Role select, updated copy 'acesso completo ao tenant'"
  - "tests/integration/tenant-role-migration.test.ts — 4 real assertions (was it.todo()) verifying the collapse live"
affects: [05-04-routing, 05-05-agency-actions, 05-06-agency-tenant-management-ui, 05-08-leads-scope-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-data migrations that narrow a CHECK constraint must run a pre-migration row-count-by-value query first (documented in the migration's own SQL comment) — same discipline as the agency migrations in Plan 02"
    - "Integration tests that assert a CHECK constraint rejects an insert must create real parent rows (tenant + user) first so the constraint violation isn't masked by an unrelated FK violation"

key-files:
  created:
    - supabase/migrations/0020_collapse_tenant_role.sql
  modified:
    - lib/actions/tenants.ts
    - components/tenants/add-user-modal.tsx
    - tests/tenants.test.ts
    - tests/integration/tenant-role-migration.test.ts

key-decisions:
  - "Pre-migration verification (SELECT role, count(*) FROM tenant_users GROUP BY role) found only {tenant_admin: 1} live — zero 'viewer' rows existed at migration time (the only prior viewer test row from the Auth Hook debug session had already been cleaned up), so the promotive UPDATE is a documented no-op on current data but still required to safely widen/narrow the CHECK constraint for any future rows"
  - "tests/tenants.test.ts's removed 'rejects role super_admin' test also resolved 2 of the 4 pre-existing tsc --noEmit errors flagged in deferred-items.md (Plan 05-01) as a natural side effect of the plan's own scope — not a separate fix"

requirements-completed: [AGENCY-07]

# Metrics
duration: ~19min
completed: 2026-07-09
---

# Phase 05 Plan 03: Cliente Role Collapse Summary

**Collapsed `tenant_users.role` to a single surviving value `tenant_admin` via a live-data migration (0020) on production Supabase, then removed the now-meaningless role choice from `createTenantUser` and the Super Admin's add-user dialog.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-07-09T20:49:00-03:00
- **Completed:** 2026-07-09T21:08:00-03:00
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Verified live `tenant_users` role distribution before migrating: `{tenant_admin: 1}`, zero `viewer` rows, no unexpected 3rd value
- Created and applied `supabase/migrations/0020_collapse_tenant_role.sql` live to `rvkkvjitfddtbdpkupok` — promotes any `viewer` row to `tenant_admin`, then tightens `tenant_users_role_check` to `CHECK (role = 'tenant_admin')`
- Confirmed live post-migration: `SELECT DISTINCT role FROM tenant_users` returns exactly `{tenant_admin}`
- Filled `tests/integration/tenant-role-migration.test.ts`'s 4 `it.todo()` cases with real assertions against the live database (all passing, no test data leaked — verified row count returned to 1 after `afterAll` cleanup)
- Simplified `createTenantUser` (`lib/actions/tenants.ts`): dropped `role` from the Zod schema and the function's input type, insert now always uses the literal `role: 'tenant_admin'`
- Simplified `components/tenants/add-user-modal.tsx`: removed the Role `<Select>` field and its now-unused imports, updated `DialogDescription` copy to "O usuário receberá acesso completo ao tenant"
- Updated `tests/tenants.test.ts`'s `createTenantUser` describe block to the new no-role signature, removed the now-impossible "rejects role super_admin" test

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 0020 (role collapse) + fill tenant-role-migration.test.ts** - `651820a` (feat)
2. **Task 2: Apply migration 0020 to live database** - no new commit (SQL file already committed in Task 1; this task applied it live via `supabase db push` and verified via SQL query — nothing further to stage)
3. **Task 3: Simplify createTenantUser and the add-user dialog (drop role choice)** - `157658c` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `supabase/migrations/0020_collapse_tenant_role.sql` - promotes `viewer`→`tenant_admin`, tightens CHECK to `role = 'tenant_admin'`; applied live
- `lib/actions/tenants.ts` - `createTenantUser` no longer accepts `role`; always inserts `'tenant_admin'`
- `components/tenants/add-user-modal.tsx` - Role select field removed; copy updated to "acesso completo ao tenant"
- `tests/tenants.test.ts` - `createTenantUser` tests updated to new signature; "rejects role super_admin" test removed (scenario no longer possible)
- `tests/integration/tenant-role-migration.test.ts` - 4 `it.todo()` → real, passing assertions against the live database

## Decisions Made

- Ran the required pre-migration row-count-by-role query (per the plan's Rule-2 threat mitigation, T-05-06) before writing/applying the migration — result `{tenant_admin: 1}`, no `viewer` rows, no unexpected 3rd value, so the migration proceeded as written with no manual-review halt needed
- The INSERT-rejection test in `tenant-role-migration.test.ts` creates a real tenant + real user first (mirroring the `sync-jobs-rls.test.ts` fixture pattern) so the expected failure is unambiguously the `tenant_users_role_check` constraint, not an unrelated FK violation
- Followed the `sync-jobs-rls.test.ts` cleanup discipline exactly (delete via the untouched service-role client, check `.error` on every delete, never call `signInWithPassword` on the shared client) per the explicit warning in this plan's task context about the resolved `test-tenants-leaking-into-production` bug — verified no test tenant/user rows were left behind after the test run

## Deviations from Plan

None - plan executed exactly as written. The pre-migration verification query returning zero `viewer` rows (rather than the `lukseg`/`beta-test` viewer rows the plan anticipated) is a data-state observation, not a deviation — the migration's promotive `UPDATE` and tightened `CHECK` were applied exactly as specified regardless, and the task's own acceptance criteria ("no unexpected 3rd value") were met.

## Issues Encountered

- `tests/integration/tenant-role-migration.test.ts` needed to run without an explicit `vitest.config.ts` path (project uses `vitest.config.mts`); resolved by running `npx vitest run tests/integration/tenant-role-migration.test.ts` without a `--config` override, which correctly picked up the project's default config and `.env.test.local`.
- Pre-existing `tsc --noEmit` errors in `tests/integration/vault-rpc.test.ts` (lines 124, 135) remain — confirmed unrelated to this plan's files (out of scope per the deviation rules' scope boundary), already logged in `deferred-items.md` from Plan 05-01. The other 2 pre-existing errors flagged there (`tests/tenants.test.ts:119,122`) are now resolved as a natural consequence of this plan's own Task 3 changes.

## User Setup Required

None - no external service configuration required. The migration was applied directly via `supabase db push` against the already-linked project.

## Next Phase Readiness

- Live `tenant_users.role` confirmed to contain only `tenant_admin` — no tenant lost access (0 rows were `viewer` at migration time; the constraint change itself is non-destructive)
- `createTenantUser` and the add-user dialog no longer offer/accept a role choice — matches CONTEXT.md D-03's "Cliente = full access" module concept
- All tests green (18 test files, 131 passed / 1 skipped / 21 todo), `npx tsc --noEmit` shows no new errors, `npm run build` passes cleanly
- Ready for Plan 04 (routing) and subsequent agency-facing plans, which depend on the simplified single-role tenant model

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: supabase/migrations/0020_collapse_tenant_role.sql
- FOUND: lib/actions/tenants.ts
- FOUND: components/tenants/add-user-modal.tsx
- FOUND: tests/tenants.test.ts
- FOUND: tests/integration/tenant-role-migration.test.ts
- FOUND: .planning/phases/05-agencia-multi-cliente/05-03-SUMMARY.md
- FOUND: 651820a (Task 1 commit)
- FOUND: 157658c (Task 3 commit)
