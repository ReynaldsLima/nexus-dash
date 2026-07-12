---
phase: 05-agencia-multi-cliente
plan: 02
subsystem: database
tags: [supabase, rls, migrations, agency, custom-access-token-hook]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 01
    provides: "tests/agency-rls.test.ts Wave 0 scaffold — the exact it.todo() cases this plan fills in"
provides:
  - "agencies, agency_users, agency_tenants tables live in Supabase (rvkkvjitfddtbdpkupok) with RLS enabled"
  - "get_agency_id() SQL helper, parallel to get_tenant_id(), callable from RLS policies"
  - "_agency_select RLS policy on tenants/campaign_metrics/ad_accounts/sync_jobs/daily_rollups"
  - "custom_access_token_hook Postgres function extended with an agency branch (migration 0019) — NOTE: not currently wired to the live Auth Hook, see Deviations"
  - "types/database.types.ts regenerated with agencies/agency_tenants/agency_users/get_agency_id"
affects: [05-04-routing, 05-05-agency-actions, 05-06-agency-tenant-management-ui, 05-07-agency-landing-page, 05-08-leads-scope-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agency data layer follows the exact tenant-layer pattern established in Phase 1: dedicated JWT-only helper function (get_agency_id, SECURITY DEFINER, STABLE), always wrapped in (SELECT ...) inside policies, third _agency_select policy OR-combined with the existing _super_admin_all/_tenant_select pair rather than modifying them"
    - "RLS integration test fixtures preset app_metadata directly at admin.createUser() time (bypassing hook lookup) to test policies independent of hook wiring — established precedent from tests/integration/sync-jobs-rls.test.ts, now also used in tests/agency-rls.test.ts"

key-files:
  created:
    - supabase/migrations/0017_create_agencies_schema.sql
    - supabase/migrations/0018_agency_scoped_rls_policies.sql
    - supabase/migrations/0019_custom_access_token_hook_agency.sql
  modified:
    - types/database.types.ts
    - tests/agency-rls.test.ts

key-decisions:
  - "Migrations 0017-0019 applied verbatim per plan spec — no deviation from the plan's exact SQL, since it already matched the project's established helper-function/RLS-policy/hook conventions"
  - "tests/agency-rls.test.ts fixtures preset app_metadata: { role: 'agency', agency_id } directly at admin.createUser() time instead of relying on the Custom Access Token Hook's agency_users lookup — necessary given the discovered hook-wiring bug (see Deviations), and consistent with the pre-existing sync-jobs-rls.test.ts pattern for tenant_admin"
  - "supabase gen types typescript --schema public dropped the graphql_public schema block present in the previously committed types/database.types.ts — confirmed unused anywhere in the codebase (grep), accepted as a harmless CLI-version artifact rather than reverted"

requirements-completed: [AGENCY-06]

# Metrics
duration: 33min
completed: 2026-07-09
---

# Phase 05 Plan 02: Agency Data Layer Summary

**Three new Supabase migrations (agencies/agency_users/agency_tenants tables + RLS + get_agency_id(), a 5-table _agency_select policy pass, and a Custom Access Token Hook extension) applied live to rvkkvjitfddtbdpkupok, with tests/agency-rls.test.ts's 7 it.todo() cases converted to real, passing assertions — while uncovering that this project's live Auth Hook is wired to an unrelated Edge Function, not the Postgres function these migrations extend.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-09T21:57:51Z
- **Completed:** 2026-07-09T22:30:20Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Created and applied `supabase/migrations/0017_create_agencies_schema.sql` — `agencies`, `agency_users`, `agency_tenants` tables, all RLS-enabled, plus `get_agency_id()` (JWT-only, `SECURITY DEFINER`, parallel to `get_tenant_id()`)
- Created and applied `supabase/migrations/0018_agency_scoped_rls_policies.sql` — added `tenants_agency_select`, `campaign_metrics_agency_select`, `ad_accounts_agency_select`, `sync_jobs_agency_select`, `daily_rollups_agency_select`, none of which touch the pre-existing `_super_admin_all`/`_tenant_select` policies
- Created and applied `supabase/migrations/0019_custom_access_token_hook_agency.sql` — extended `custom_access_token_hook` with an agency-membership branch, checked before the `tenant_users` lookup
- Regenerated `types/database.types.ts` — new `agencies`/`agency_tenants`/`agency_users` Row/Insert/Update/Relationships types (alphabetically placed between `ad_accounts` and `campaign_metrics`) and `get_agency_id` in the `Functions` block
- Filled `tests/agency-rls.test.ts` — all 7 `it.todo()` cases (6 in "Agency-scoped RLS (AGENCY-06)", 1 in "Agency-scoped tenant list resolution (AGENCY-03/04)") replaced with real, currently-passing assertions against the live database
- Confirmed via direct SQL query (`pg_policies`) that all 5 `_agency_select` policies exist live, and via `pg_proc` that `get_agency_id` exists live

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migrations 0017 (schema), 0018 (agency RLS), 0019 (hook)** - `18857a7` (feat)
2. **Task 2: Apply migrations to live DB + regenerate types + fill agency-rls tests** - `256db9a` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `supabase/migrations/0017_create_agencies_schema.sql` - agencies/agency_users/agency_tenants tables, RLS, get_agency_id()
- `supabase/migrations/0018_agency_scoped_rls_policies.sql` - 5 new `_agency_select` policies (tenants, campaign_metrics, ad_accounts, sync_jobs, daily_rollups)
- `supabase/migrations/0019_custom_access_token_hook_agency.sql` - custom_access_token_hook extended with agency branch (checked before tenant_users)
- `types/database.types.ts` - regenerated: new agencies/agency_tenants/agency_users table types + get_agency_id function type
- `tests/agency-rls.test.ts` - 7 it.todo() → real assertions, all passing against the live database (8/8 tests green)

## Decisions Made

- Applied the plan's exact SQL for all three migrations verbatim — it already matched the project's established `get_tenant_id()`/RLS-policy/hook conventions from Phase 1, so no adaptation was needed
- Chose to preset `app_metadata: { role: 'agency', agency_id }` directly at `admin.createUser()` time in the test fixtures (mirroring `tests/integration/sync-jobs-rls.test.ts`'s existing pattern for `tenant_admin`) rather than relying on the Custom Access Token Hook's `agency_users` lookup to populate the JWT — this correctly isolates and verifies the `_agency_select` RLS POLICIES (this plan's actual AGENCY-06 deliverable) independent of the pre-existing, out-of-scope hook-wiring bug described below
- Accepted the loss of the unused `graphql_public` schema block from `types/database.types.ts` (dropped by the current CLI's `--schema public` flag behavior) after confirming via grep that no code in the repository references it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Removed a diagnostic Edge Function download that broke `tsc --noEmit`**
- **Found during:** Task 2, while investigating why `tests/agency-rls.test.ts` initially failed against the live database
- **Issue:** Ran `supabase functions download custom-access-token` to inspect the live Auth Hook's Edge Function source for debugging (see CRITICAL finding below). This wrote Deno-flavored TypeScript into `supabase/functions/custom-access-token/index.ts`, which the project's `tsconfig.json` (excludes only `node_modules`) picked up, producing 5 new `tsc --noEmit` errors (`Cannot find name 'Deno'`, unresolvable `esm.sh` import, etc.)
- **Fix:** Deleted `supabase/functions/` entirely after reading and documenting the function's source — it was a read-only diagnostic step, not a plan deliverable
- **Files modified:** none (directory created and removed within the same task, never committed)
- **Commit:** N/A (never staged)

### Not Fixed — Flagged for User Decision (Rule 4)

**2. [CRITICAL — architectural] Live Auth Hook is wired to an unrelated Edge Function, not `public.custom_access_token_hook`**
- **Found during:** Task 2, while filling `tests/agency-rls.test.ts`'s real assertions
- **Issue:** Signing in as a freshly created test user (with no `app_metadata` preset) produced a JWT with `app_metadata = {"plan":"trial","provider":"email","providers":["email"],"role":"visualizador","slug":null,"tenant_id":null,"trial_ends_at":null}` — a shape that matches NONE of this project's own hook logic (migrations 0005/0019 use `role`/`tenant_id`/`tenant_slug`/`agency_id`, English role values, no `plan`/`trial_ends_at`/`visualizador`).
  - Confirmed via the Supabase Management API (`GET /v1/projects/rvkkvjitfddtbdpkupok/config/auth`): `hook_custom_access_token_enabled: true`, `hook_custom_access_token_uri: https://rvkkvjitfddtbdpkupok.supabase.co/functions/v1/custom-access-token` — an HTTP Edge Function hook, not a `pg-functions://...` URI pointing at the Postgres function this plan (and Phase 1) maintains.
  - Inspected the deployed Edge Function's source (downloaded, read, then deleted — see Rule 3 fix above): it never queries `agency_users` or `tenant_users`. It only echoes whatever `app_metadata.tenant_id`/`role`/`slug` a user already has at hook-invocation time, and separately queries `tenants.trial_ends_at`/`plan` — columns that **do not exist** in this project's live `tenants` table (confirmed via `information_schema.columns`), so that part silently no-ops. It also writes the tenant slug under the key `slug`, not `tenant_slug` — the key `app/[tenant-slug]/layout.tsx` actually reads.
  - **Impact:** the entire Postgres-hook architecture designed in Phase 1 (D-13/D-14) and extended here for Phase 5 (agency role/`agency_id` injection) is dead code in the live, deployed app. `custom_access_token_hook` never fires for real sign-ins today. This means: (a) real agency members will NOT receive `role='agency'`/`agency_id` on sign-in until the hook wiring is corrected — Plan 04 (routing) and Plan 07 (agency landing page) both assume this works; (b) `tokenSlug` in `app/[tenant-slug]/layout.tsx` is very likely `null` for every real signed-in user right now, independent of this plan.
- **Why not fixed:** switching a live project's Auth Hook selection (Supabase Dashboard → Authentication → Hooks, or via Management API) changes JWT claims for every authenticated session across the entire deployed app immediately — this is a Rule 4 architectural/production-safety decision, not a scoped code fix. Two remediation paths exist and the user should choose: (1) switch the Dashboard hook selection to `pg-functions://postgres/public/custom_access_token_hook` (matches all of this project's documented design, zero new code), or (2) update the Edge Function itself to replicate the `agency_users`/`tenant_users` lookup logic (keeps HTTP-hook infra, requires new Edge Function code and a `tenant_slug` key fix).
- **Workaround for this plan's own verification:** `tests/agency-rls.test.ts` presets `app_metadata` directly at `admin.createUser()` time, which correctly tests the `_agency_select` RLS policies (this plan's actual deliverable, AGENCY-06) independent of the hook bug. All 8 tests in the file pass live.
- **Logged to:** `.planning/phases/05-agencia-multi-cliente/deferred-items.md` (Plan 05-02 section) with full reproduction detail.
- **Recommend:** resolve before Plan 04 (routing) or Plan 07 (agency landing page) execute, since both assume a real browser sign-in produces a JWT with `role='agency'`/`agency_id` populated.

## Issues Encountered

- `npx tsc --noEmit` still reports the same 4 pre-existing errors already logged in `deferred-items.md` from Plan 05-01 (`tests/integration/vault-rpc.test.ts` x2, `tests/tenants.test.ts` x2) — confirmed unrelated to this plan's files, left untouched per scope boundary.
- `npm run build` passes cleanly (Next.js 16.2.6, Turbopack) with no new warnings or errors.

## User Setup Required

**Action needed before Phase 5's agency sign-in flow works end-to-end in the real app:** decide how to resolve the Auth Hook wiring issue described in Deviations #2 above. Recommended: in Supabase Dashboard → Authentication → Hooks → Custom Access Token, switch the selected hook from the `custom-access-token` Edge Function to the Postgres function `public.custom_access_token_hook` (already correct and tested via this plan's migrations). No code changes required for this option — it is a Dashboard configuration change only. Alternatively, if the Edge Function must remain in place for another reason, it needs new code to query `agency_users`/`tenant_users` and to fix the `slug` → `tenant_slug` key mismatch.

## Next Phase Readiness

- Live schema ready: `agencies`/`agency_users`/`agency_tenants` tables + RLS + `get_agency_id()` all confirmed live via direct SQL query
- All 5 `_agency_select` policies confirmed live via `pg_policies` query — existing `_super_admin_all`/`_tenant_select` policies unmodified
- `types/database.types.ts` compiles clean, reflects the new schema
- `tests/agency-rls.test.ts` has zero `it.todo()` remaining, all 8 assertions pass against the live database
- **Blocker for Plan 04/07 (not this plan):** real agency sign-ins will not receive `role='agency'`/`agency_id` in their JWT until the Auth Hook wiring decision above is made — Plan 04/07 execution should confirm this is resolved (or plan around it) before assuming end-to-end sign-in works

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: supabase/migrations/0017_create_agencies_schema.sql
- FOUND: supabase/migrations/0018_agency_scoped_rls_policies.sql
- FOUND: supabase/migrations/0019_custom_access_token_hook_agency.sql
- FOUND: types/database.types.ts
- FOUND: tests/agency-rls.test.ts
- FOUND: .planning/phases/05-agencia-multi-cliente/05-02-SUMMARY.md
- FOUND: .planning/phases/05-agencia-multi-cliente/deferred-items.md
- FOUND: 18857a7 (Task 1 commit)
- FOUND: 256db9a (Task 2 commit)
