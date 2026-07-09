---
status: resolved
trigger: "test-tenants-leaking-into-production"
created: 2026-07-09T23:20:00Z
updated: 2026-07-09T23:59:00Z
---

## Current Focus

Resolved. Fix committed (a536ffa), 36 orphaned test-fixture tenant rows purged
from the live `tenants` table (test auth.users accounts intentionally left in
place per user's choice). Final live tenant count re-verified: 2 rows
(`beta-test`, `lukseg`) — both real, none orphaned.

## Symptoms

expected: `tests/agency-rls.test.ts`'s `afterAll` (and any other integration
test file creating tenant fixtures) should delete every tenant/agency/user row
it created in `beforeAll`/`it()`, leaving the live `tenants` table exactly as
it was before the test run.

actual: Every observed test run's fixtures are still present in the live
`tenants` table — confirmed 36 total rows, 34 of which are test fixtures
(`switcher-*`, `rls-agency-tenant-*`, `rls-test-tenant-a/b`), spanning runs
from 2026-07-05 through 2026-07-09. Only `lukseg` and `beta-test` are real
tenants.

errors: `afterAll` blocks never check `.delete()` results — the failure was
completely silent until instrumented. Once instrumented, the real error is:
`{"code":"42501","message":"permission denied for table tenants","hint":"Grant
the required privileges to the current role with: GRANT SELECT ON
public.tenants TO authenticated;"}` (HTTP 403).

started: `tests/integration/sync-jobs-rls.test.ts` (pre-existing, created
before Phase 5) has been leaking `rls-test-tenant-a/b` since at least
2026-07-05. `tests/agency-rls.test.ts` (created in Phase 5 Plan 01, filled in
during Plan 02, both completed 2026-07-09) started leaking
`rls-agency-tenant-*`/`switcher-*` the same day it was filled in with real
assertions.

reproduction: `npx vitest run tests/integration/sync-jobs-rls.test.ts` — all
6 tests pass, but two new `rls-test-tenant-a`/`rls-test-tenant-b` rows are
left behind in the live `tenants` table every time. Reproduced live during
this investigation (new orphan rows `70852334-...`/`dac62e0b-...` created at
2026-07-09T23:34:49Z, confirmed still present after the run completed).

## Eliminated

- hypothesis: FK constraint from `tenant_users`/`agency_tenants`/`agency_users`/
  `sync_jobs`/`daily_rollups`/`ad_accounts` lacking `ON DELETE CASCADE` blocks
  the tenant/agency delete.
  evidence: Manually deleted the two freshly-leaked `rls-test-tenant-a/b` rows
  using the exact same `service_role` key + `.from('tenants').delete().eq('id',
  ...)` call, immediately after the failed test run — both deletes succeeded
  instantly with no FK error (`"success": true`, row returned, verified gone
  on re-query). Rules out any FK/cascade issue entirely.
  timestamp: 2026-07-09T23:40:00Z

- hypothesis: Test process is killed/times out before `afterAll` runs.
  evidence: Vitest reporter shows all 6 tests + the `afterAll` hook completing
  normally ("[DEBUG-PROBE] afterAll complete" logged, full test file exits 0).
  Not a process-kill / worktree-isolation issue.
  timestamp: 2026-07-09T23:35:00Z

- hypothesis: `SUPABASE_TEST_URL`/`SUPABASE_TEST_SERVICE_KEY` unset, tests
  self-skip, and leak comes from elsewhere.
  evidence: `.env.test.local` (gitignored, present locally) sets both vars,
  pointing at the SAME live Supabase project as `NEXT_PUBLIC_SUPABASE_URL` in
  `.env.local` (project ref `rvkkvjitfddtbdpkupok`) — by design, per STATE.md:
  "Staging schema in same Supabase project as prod ... shared auth.users."
  Confirmed the vars are actually populated and describeIfEnv runs for real.
  timestamp: 2026-07-09T23:10:00Z

- hypothesis (secondary architecture note, not the direct cause of THIS bug
  but relevant context): tests are supposed to write into the dedicated
  `staging` Postgres schema (created in migration `0001_create_staging_schema.sql`)
  but never call `.schema('staging')` on the Supabase client, so all fixture
  reads/writes actually hit `public.tenants` (the live production table).
  evidence: `grep -rn "\.schema(" tests/` returns zero matches across the
  entire test suite. This is a real, separate contributing factor (test
  fixtures are visible in prod at all, appearing in the Super Admin UI, even
  when cleanup DOES succeed) but is NOT the reason cleanup fails — the
  permission-denied evidence above is the direct, confirmed cause of orphaned
  rows. Flagging as a related architecture gap; not fixing schema isolation in
  this pass per remediation_scope's schema-change restriction, but noting it
  for the user.
  timestamp: 2026-07-09T23:15:00Z

## Evidence

- timestamp: 2026-07-09T23:05:00Z
  checked: Live `tenants` table via Node script using `.env.local`'s
  `SUPABASE_SERVICE_ROLE_KEY`.
  found: 36 total rows. Only `beta-test` (2026-05-11) and `lukseg`
  (2026-06-05) are legitimate. The other 34 rows are test fixtures:
  6x `rls-test-tenant-a`/6x `rls-test-tenant-b` pairs (created 2026-07-05 x5,
  2026-07-09 x1, all before this investigation started), plus from
  2026-07-09 (today, Phase 5 work): 3x `rls-agency-tenant-granted/ungranted/
  revoked/inactive` (4-tenant group) x3 runs, 3x `switcher-granted`/
  `switcher-other` pairs.
  implication: Confirms exact scope described by the user's screenshot —
  matches the ~4-groups-repeated pattern exactly.

- timestamp: 2026-07-09T23:20:00Z
  checked: `tests/integration/tenant-role-migration.test.ts` full contents.
  found: This file is 100% `it.todo()` placeholders (AGENCY-07 not yet
  implemented) — it creates zero fixtures, zero tenants. It is NOT a source
  of the `rls-test-tenant-a/b` leak despite matching that name pattern in the
  original symptom description.
  implication: The actual source of `rls-test-tenant-a/b` fixtures is
  `tests/integration/sync-jobs-rls.test.ts` (pre-existing Phase 1/2 file,
  unrelated to Phase 5), not the file named in the original symptom writeup.
  Investigation scope corrected accordingly.

- timestamp: 2026-07-09T23:30:00Z
  checked: Ran `npx vitest run tests/integration/sync-jobs-rls.test.ts`
  (unmodified) and re-queried the live `tenants` table immediately after.
  found: All 6 tests passed; 2 new orphan rows
  (`rls-test-tenant-a`/`rls-ta-1783640088632`,
  `rls-test-tenant-b`/`rls-tb-1783640088881`) appeared in `public.tenants`
  and were NOT cleaned up — reproduced the bug live, on demand.
  implication: Bug is 100% reproducible on the current codebase, not a
  historical artifact from an old code version.

- timestamp: 2026-07-09T23:36:00Z
  checked: Added temporary `console.log` instrumentation to
  `tests/integration/sync-jobs-rls.test.ts`'s `afterAll`, capturing
  `{ data, error }` from both delete calls, then reran the suite.
  found: `afterAll` IS invoked (confirmed via log), but both delete calls
  return `{"success":false,"error":{"code":"42501","message":"permission
  denied for table tenants","hint":"Grant the required privileges to the
  current role with: GRANT SELECT ON public.tenants TO authenticated;"},
  "status":403}`.
  implication: `serviceClient` is NOT operating as service_role by the time
  `afterAll` runs — its effective role has become `authenticated`. Root cause
  is a session-contamination bug, not RLS/FK.

- timestamp: 2026-07-09T23:38:00Z
  checked: Traced every place `serviceClient` (the module-scoped, supposedly
  service_role client) has `.auth.signInWithPassword(...)` called on it
  directly, in both `tests/agency-rls.test.ts` and
  `tests/integration/sync-jobs-rls.test.ts`.
  found: 5 occurrences total — `tests/agency-rls.test.ts` lines 181, 187,
  222, 339 (agency sign-in, super_admin sign-in, empty-agency sign-in,
  switcher sign-in — all reusing the shared `serviceClient`), and
  `tests/integration/sync-jobs-rls.test.ts` line 239 (tenant_admin sign-in in
  the last `it()` block, right before `afterAll` runs). Both files also
  contain CORRECT usages elsewhere (e.g.
  `sync-jobs-rls.test.ts`'s `userClientA = createClient(...)` — a disposable
  client, used correctly for one sign-in).
  implication: `@supabase/supabase-js`'s `createClient()` returns a client
  whose PostgREST `Authorization` header tracks its OWN internal auth session
  once `auth.signInWithPassword()`/`admin.createUser()`-then-signIn is called
  on that SAME client instance — this permanently downgrades that client from
  "service_role bearer token" to "whichever user last signed in via it" for
  every subsequent request, including `afterAll`'s cleanup deletes. The
  correct, already-partially-used pattern in this codebase is to always
  create a fresh, disposable `createClient()` instance for sign-in flows
  and leave the shared `serviceClient` variable's session untouched.

## Resolution

root_cause: In both `tests/agency-rls.test.ts` (4 call sites) and
`tests/integration/sync-jobs-rls.test.ts` (1 call site), the test code calls
`serviceClient.auth.signInWithPassword(...)` directly on the same
module-scoped Supabase client instance that is also used as the "service_role
cleanup client" in `afterAll`. Because `@supabase/supabase-js` tracks a live
auth session per client instance and uses it (instead of the original
service_role API key) as the `Authorization` bearer for all subsequent
PostgREST requests from that instance, signing in as a test user (agency,
super_admin, or tenant_admin) permanently overwrites `serviceClient`'s
effective role for the rest of the test file. Every `afterAll` delete then
runs as that authenticated test user (who lacks base table GRANTs on
`tenants`/`agencies`), fails with 42501 permission-denied, and — because
neither `afterAll` block ever inspects `{ error }` — fails completely
silently. Every test run that reaches one of these 5 call sites leaks its
fixtures into the live `tenants`/`agencies` tables permanently.

fix: Route every test-user sign-in through a disposable, throwaway
`createClient(...)` instance instead of the shared `serviceClient`, so
`serviceClient`'s session is never mutated and remains authenticated as
service_role for `afterAll`. Applied to all 5 call sites across both files.
Also added explicit `{ error }` checking + `console.error` logging on every
`afterAll` delete/deleteUser call in both files, so any future cleanup
failure is loud instead of silent.

verification: Confirmed. Baseline tenant count was 38 before the fix
verification run. Ran `npx vitest run tests/agency-rls.test.ts
tests/integration/sync-jobs-rls.test.ts` (14 tests, all pass, zero
console.error output from the new error-checking) then re-queried the live
`tenants` table: still 38 rows — net zero change, meaning both files' own
fixtures were created AND fully cleaned up this time. Also ran the full
suite (`npx vitest run`, 128 passed / 1 skipped / 25 todo, no regressions)
and re-confirmed tenant count unchanged (38) afterward. Root cause is fixed
and verified reproducible-fix (bug reproduced once more against the
unmodified files earlier in this session, then fix applied and reproducibly
verified clean).

## Purge — Orphaned Test Tenants (COMPLETED 2026-07-09T23:59:00Z)

User confirmed via checkpoint: purge the 36 orphan tenant rows below, exclude
`lukseg`/`beta-test`, and explicitly do NOT touch `auth.users` test accounts
(leave `agency-rls-*@test.nexus`, `switcher-*@test.nexus`, `rls-test-*@test.nexus`
in place).

Executed: re-verified all 36 ids still present live and matched the expected
test-fixture name patterns (safety check), confirmed neither `lukseg`
(`9f7e3c67-...`) nor `beta-test` (`8cf4d5ba-...`) was in the purge list, then
deleted all 36 rows via the service_role REST API (cascading
`campaign_metrics`/`sync_jobs`/`tenant_users`/`agency_tenants` per FK
`ON DELETE CASCADE`). All 36 deletes succeeded (36/36). Re-queried the live
`tenants` table afterward: exactly 2 rows remain — `beta-test` and `lukseg`.
`auth.users` was not touched, per user's explicit choice.

36 orphaned rows were permanently stuck in the live `tenants` table from
historical runs (2026-07-05 through this investigation's own reproduction
step). This includes 34 rows that predate this fix, plus 2 rows
(`560865da-92d0-488e-990f-cecc08bd0ffa` / `e7874ba5-dd98-4af4-8396-0aa9f4b93b05`)
created during this investigation's deliberate bug-reproduction step (running
the OLD, unfixed code with instrumentation to capture the 42501 error) — these
were never cleaned up because that run intentionally used the pre-fix code.

**Explicitly excluded from the purge list:** `lukseg` (9f7e3c67-...) and
`beta-test` (8cf4d5ba-...) — the only two real tenants.

Full purge list (36 rows, all match test-fixture naming patterns
`rls-test-tenant-a/b`, `rls-agency-tenant-*`, `switcher-*`):

| id | name | slug | created_at |
|----|------|------|------------|
| 0d586b8d-12d0-48db-97db-06923d8d543f | rls-test-tenant-a | rls-ta-1783229563877 | 2026-07-05T05:32:48Z |
| 8c9612e4-ba8c-4e8f-aa30-a5a44c6783de | rls-test-tenant-b | rls-tb-1783229564713 | 2026-07-05T05:32:48Z |
| 51b9133c-a68a-4c6d-85a3-c9398971e077 | rls-test-tenant-a | rls-ta-1783229913643 | 2026-07-05T05:38:37Z |
| d5c49c9b-00c7-435f-b330-71f422177df7 | rls-test-tenant-b | rls-tb-1783229914022 | 2026-07-05T05:38:37Z |
| 94b711fe-2076-40f0-ae05-6effb5aec90c | rls-test-tenant-a | rls-ta-1783231417550 | 2026-07-05T06:03:41Z |
| 4b05e991-d51c-43ca-a42b-7a4f54e281a6 | rls-test-tenant-b | rls-tb-1783231418386 | 2026-07-05T06:03:41Z |
| 67e5b3a8-aebc-4a03-893a-e5aa024dd5e4 | rls-test-tenant-a | rls-ta-1783231625865 | 2026-07-05T06:07:09Z |
| be636bfb-1c73-4c75-a4c7-4ec241f44627 | rls-test-tenant-b | rls-tb-1783231626588 | 2026-07-05T06:07:10Z |
| b6077eca-065e-436e-b523-f9435926b5cd | rls-test-tenant-a | rls-ta-1783232767799 | 2026-07-05T06:26:11Z |
| 6c932731-df00-4103-9efc-6a511e1b275d | rls-test-tenant-b | rls-tb-1783232768560 | 2026-07-05T06:26:12Z |
| 3c068323-130f-45dd-982b-8951637072c0 | rls-test-tenant-a | rls-ta-1783634048744 | 2026-07-09T21:54:10Z |
| 219b0204-0278-437f-9439-4e0424f0a968 | rls-test-tenant-b | rls-tb-1783634049932 | 2026-07-09T21:54:11Z |
| 8344a8d6-95b7-4fb5-835d-4800b78f8616 | rls-test-tenant-a | rls-ta-1783635477529 | 2026-07-09T22:17:59Z |
| 48a1b70a-f90a-4981-99c6-7da7ccb44ec8 | rls-test-tenant-b | rls-tb-1783635478265 | 2026-07-09T22:17:59Z |
| f1219bfb-eced-4d84-8382-ce1a46c6bb9e | rls-agency-tenant-granted | rls-agency-tg-1783635478325 | 2026-07-09T22:17:59Z |
| dc300b51-82b1-4aaa-9f19-547fe9860586 | rls-agency-tenant-ungranted | rls-agency-tu-1783635478388 | 2026-07-09T22:17:59Z |
| d12e17d9-632a-48bf-9918-eaf13e51c2d0 | rls-agency-tenant-revoked | rls-agency-tr-1783635478457 | 2026-07-09T22:17:59Z |
| 71685d9b-cc91-4d77-ab28-6dd2f469dbab | rls-agency-tenant-inactive | rls-agency-ti-1783635478530 | 2026-07-09T22:17:59Z |
| b4bd8277-3f05-441d-9299-d0cf561cd715 | switcher-granted | switcher-g-1783635481349 | 2026-07-09T22:18:02Z |
| 3331c934-7d32-4998-b5e2-7ad46184330b | switcher-other | switcher-o-1783635481440 | 2026-07-09T22:18:02Z |
| df07262b-ba1d-4585-93bf-d8dc3a0b313b | rls-agency-tenant-granted | rls-agency-tg-1783636004190 | 2026-07-09T22:26:45Z |
| 926abb21-7faa-4a9d-b05d-79b20ff888d2 | rls-agency-tenant-ungranted | rls-agency-tu-1783636004283 | 2026-07-09T22:26:45Z |
| b5283578-47a3-4adb-8f51-514df3cc57ae | rls-agency-tenant-revoked | rls-agency-tr-1783636004363 | 2026-07-09T22:26:45Z |
| fe552e3c-06d6-4c49-a9e3-0d0410dedeed | rls-agency-tenant-inactive | rls-agency-ti-1783636004416 | 2026-07-09T22:26:45Z |
| f1e649d5-95bf-41de-8673-70e6c1da477e | switcher-granted | switcher-g-1783636007568 | 2026-07-09T22:26:48Z |
| 68058c8e-f9e0-41ce-b42f-b81122ed7e68 | switcher-other | switcher-o-1783636007665 | 2026-07-09T22:26:48Z |
| 4d5d3191-cabf-417f-a27d-a01fb75f4e99 | rls-test-tenant-a | rls-ta-1783636021170 | 2026-07-09T22:27:02Z |
| 0dcb0228-26d0-44e3-85b6-66fe1e5683d0 | rls-test-tenant-b | rls-tb-1783636021443 | 2026-07-09T22:27:02Z |
| 3f1087ed-a619-4fc7-a05d-338343ee0365 | rls-agency-tenant-granted | rls-agency-tg-1783636021559 | 2026-07-09T22:27:02Z |
| 3de4e7b2-b4b6-4a49-8a39-493cc66aedbe | rls-agency-tenant-ungranted | rls-agency-tu-1783636021613 | 2026-07-09T22:27:02Z |
| e8564d28-8d25-4a59-b1ed-20277d84e765 | rls-agency-tenant-revoked | rls-agency-tr-1783636021660 | 2026-07-09T22:27:02Z |
| c8a13c8d-4d37-43d7-98a5-bf9a6d8f5f8e | rls-agency-tenant-inactive | rls-agency-ti-1783636021714 | 2026-07-09T22:27:02Z |
| 81544063-1f49-4eb2-bc67-e0133a4fd3c5 | switcher-granted | switcher-g-1783636024278 | 2026-07-09T22:27:05Z |
| e5e3fcf6-4d2c-4c45-954c-275fe2fce209 | switcher-other | switcher-o-1783636024377 | 2026-07-09T22:27:05Z |
| 560865da-92d0-488e-990f-cecc08bd0ffa | rls-test-tenant-a | rls-ta-1783640157672 | 2026-07-09T23:35:59Z |
| e7874ba5-dd98-4af4-8396-0aa9f4b93b05 | rls-test-tenant-b | rls-tb-1783640157915 | 2026-07-09T23:35:59Z |

Deleting these tenant rows will CASCADE-delete their associated
`campaign_metrics`/`sync_jobs`/`tenant_users`/`agency_tenants` rows (all have
`ON DELETE CASCADE` per migration 0007 and the Phase 5 agency schema). Some
of these tenants also have orphaned `auth.users` rows (the test users created
alongside them, e.g. `agency-rls-*@test.nexus`, `switcher-*@test.nexus`,
`rls-test-*@test.nexus`) that are NOT automatically cleaned by deleting the
tenant row (no FK from `auth.users` to `tenants`) — these should also be
purged separately but were not enumerated here pending user confirmation on
scope.

files_changed:
  - tests/agency-rls.test.ts
  - tests/integration/sync-jobs-rls.test.ts
