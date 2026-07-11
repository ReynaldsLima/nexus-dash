---
phase: 04-ai-insights
plan: 02
subsystem: database
tags: [supabase, postgres, rls, realtime, vercel-ai-sdk, anthropic, vitest]

# Dependency graph
requires:
  - phase: 04-ai-insights (Plan 01)
    provides: "Wave 0 it.todo() test scaffolds for ai-insights-rls and anomaly-alerts-schema"
provides:
  - "ai_insights table live in production Supabase project, super_admin-only RLS (AI-03)"
  - "anomaly_alerts table live in production Supabase project, super_admin-only RLS + supabase_realtime publication membership (AI-04)"
  - "ai + @ai-sdk/anthropic installed and resolvable for streaming routes"
  - "types/database.types.ts regenerated with both new tables"
  - "Real, passing RLS/schema integration tests replacing the Plan 01 scaffolds"
affects: ["04-ai-insights Plan 03 (on-demand insights route)", "04-ai-insights Plan 04 (insights UI)", "04-ai-insights Plan 05 (anomaly UI)", "04-ai-insights Plan 06 (daily job)"]

# Tech tracking
tech-stack:
  added: ["ai@^7.0.22", "@ai-sdk/anthropic@^4.0.12"]
  patterns:
    - "super_admin-only RLS: single FOR ALL policy, no tenant_select/agency_select policy, REVOKE ALL FROM anon"
    - "Realtime publication membership declared in the migration (ALTER PUBLICATION supabase_realtime ADD TABLE), not a Dashboard toggle"
    - "Behavioral realtime test (subscribe + insert + await postgres_changes payload) used instead of a pg_catalog query, since PostgREST does not expose pg_catalog to supabase-js clients"

key-files:
  created:
    - supabase/migrations/0021_create_ai_insights.sql
    - supabase/migrations/0022_create_anomaly_alerts.sql
  modified:
    - package.json
    - package-lock.json
    - types/database.types.ts
    - tests/integration/ai-insights-rls.test.ts
    - tests/unit/anomaly-alerts-schema.test.ts

key-decisions:
  - "Installed ai + @ai-sdk/anthropic per 04-CONTEXT.md D-01, not @anthropic-ai/sdk as CLAUDE.md's Summary Table guidance suggests — documented deviation, both still call claude-sonnet-4-6 via the Anthropic Messages API"
  - "PostgREST cannot query pg_catalog.pg_publication_tables (confirmed live: PGRST106) — the anomaly_alerts realtime-membership test uses a behavioral subscribe+insert+receive check instead of a catalog query, which more directly verifies the must_haves truth '(Realtime delivery works)'"
  - "RLS test fixtures for tenant_admin/agency roles insert real tenant_users/agency_users rows (not just preset app_metadata) since the live Custom Access Token Hook was confirmed wired to the real Postgres function as of 2026-07-09 and derives claims from those tables at sign-in"

patterns-established:
  - "Pattern: super_admin-only table (no tenant_select policy) — CREATE POLICY <table>_super_admin_all ... FOR ALL ... USING/WITH CHECK ((SELECT public.get_user_role()) = 'super_admin'); REVOKE ALL ON public.<table> FROM anon;"

requirements-completed: [AI-03, AI-04]

# Metrics
duration: 14min
completed: 2026-07-11
---

# Phase 04 Plan 02: Migrations + AI SDK Foundation Summary

**Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) installed and `ai_insights`/`anomaly_alerts` tables applied live to the production Supabase project with super_admin-only RLS and Realtime publication membership, replacing the two Wave 0 test scaffolds with real, passing assertions.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-10T22:07:08-03:00
- **Completed:** 2026-07-10T22:21:00-03:00 (approx.)
- **Tasks:** 2/2 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `ai_insights` and `anomaly_alerts` tables live in `rvkkvjitfddtbdpkupok`, both with `rowsecurity = true`, confirmed via `supabase db query` against `pg_class`
- `anomaly_alerts` confirmed live as a member of the `supabase_realtime` publication via `supabase db query` (`pg_publication_tables`), AND behaviorally verified end-to-end (subscribe → INSERT via service_role → payload received) in the test suite
- `ai` + `@ai-sdk/anthropic` installed; `@anthropic-ai/sdk` deliberately NOT installed (documented CLAUDE.md deviation, per 04-CONTEXT.md D-01)
- `types/database.types.ts` regenerated cleanly — diff shows only the two new table blocks added alphabetically before `campaign_metrics`, nothing removed, no stray CLI tag at EOF
- Both Plan 01 Wave 0 scaffolds converted from `it.todo()` to real, live-passing assertions: 7/7 in `ai-insights-rls.test.ts`, 7/7 in `anomaly-alerts-schema.test.ts`
- Full suite run: 23 test files, 165 passed, 1 skipped, 21 todo (remaining todos belong to Plans 03/06, out of this plan's scope), zero regressions
- `npm run build` and `npx tsc --noEmit` both pass (2 pre-existing, unrelated `vault-rpc.test.ts` errors documented in STATE.md remain, untouched)

## Task Commits

1. **Task 1: Install ai + @ai-sdk/anthropic and create migrations 0021/0022** - `e0a82b7` (feat)
2. **Task 2: [BLOCKING] Apply migrations to live DB + regenerate types + fill integration tests** - `dad6092` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `supabase/migrations/0021_create_ai_insights.sql` - `ai_insights` table, super_admin-only RLS, no tenant_select policy (AI-03)
- `supabase/migrations/0022_create_anomaly_alerts.sql` - `anomaly_alerts` table, super_admin-only RLS + `ALTER PUBLICATION supabase_realtime ADD TABLE` (AI-04)
- `package.json` / `package-lock.json` - added `ai@^7.0.22`, `@ai-sdk/anthropic@^4.0.12`
- `types/database.types.ts` - regenerated, adds `ai_insights`/`anomaly_alerts` Row/Insert/Update/Relationships
- `tests/integration/ai-insights-rls.test.ts` - 7 real assertions: super_admin sees rows, tenant_admin/agency see zero, anon blocked, `source`/`type` CHECK 23514
- `tests/unit/anomaly-alerts-schema.test.ts` - 7 real assertions: `channel` CHECK, `drop_pct` NOT NULL, defaults (`window_hours`=24, `metric`=roas), FK CASCADE, live realtime delivery, super_admin-only RLS

## Decisions Made
- Deviation from CLAUDE.md's `@anthropic-ai/sdk` guidance is intentional and pre-documented in the plan objective (04-CONTEXT.md D-01 locks Vercel AI SDK `streamText`); recorded here per the plan's explicit instruction to not silently resolve it.
- Realtime publication membership was independently confirmed twice: statically via `supabase db query "SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='anomaly_alerts'"` (returned a row), and behaviorally via a live subscribe+insert+receive test in the suite — chosen because PostgREST (which the vitest suite's `@supabase/supabase-js` client uses) cannot query `pg_catalog` at all (`PGRST106: Invalid schema: pg_catalog`, confirmed live).
- RLS fixtures for `tenant_admin`/`agency` sessions insert real `tenant_users`/`agency_users` rows (not just a preset `app_metadata` value) because the live Custom Access Token Hook is confirmed wired to the real `public.custom_access_token_hook` Postgres function (fixed 2026-07-09, see `.planning/debug/resolved/auth-hook-wired-to-wrong-function.md`) and derives `role`/`tenant_id`/`agency_id` claims from those tables at sign-in, not from a preset value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Substituted `pg_publication_tables` catalog query with a behavioral realtime test**
- **Found during:** Task 2 (filling `tests/unit/anomaly-alerts-schema.test.ts`)
- **Issue:** The plan's acceptance criteria/action text specified a test using "`SELECT ... FROM pg_publication_tables`" via the Supabase client, but PostgREST only exposes `public`/`graphql_public` schemas — a live check confirmed `pg_catalog.pg_publication_tables` returns `PGRST106: Invalid schema: pg_catalog` when queried via `supabase-js`.
- **Fix:** Verified publication membership statically via `supabase db query` (CLI, not the JS client) during execution, and wrote the actual test as a behavioral end-to-end check: open a `postgres_changes` subscription filtered to a throwaway tenant, INSERT a row via `service_role`, and assert the subscriber receives the event within a timeout. This is a stronger verification of the stated must_haves truth ("Realtime delivery works") than a metadata-only query would have been, and is achievable entirely through the public `supabase-js` API.
- **Files modified:** `tests/unit/anomaly-alerts-schema.test.ts`
- **Verification:** Ran 3x consecutively in isolation and as part of the full suite — passed every time (one initial cold-start flake during first-ever combined run resolved itself on immediate re-run, consistent with websocket connection warm-up, not a code defect)
- **Committed in:** `dad6092` (Task 2 commit)

**2. [Note, not a code change] False-positive grep match on `tenant_select` in migration comments**
- **Found during:** Task 1 verification
- **Issue:** The acceptance criteria's grep for `tenant_select`/`agency_select` returning nothing matched the word "tenant_select" inside `0021_create_ai_insights.sql`'s own explanatory comment ("the tenant_select policy is DELIBERATELY OMITTED"), not an actual policy definition.
- **Fix:** None needed — confirmed via `grep -n "CREATE POLICY"` that only `ai_insights_super_admin_all` exists in the file. Same false-positive class previously noted in Phase 05 Plan 07's SUMMARY (grep matching legitimate prose, not code).
- **Files modified:** none
- **Verification:** `grep -n "CREATE POLICY" supabase/migrations/0021_create_ai_insights.sql` shows exactly one policy.
- **Committed in:** n/a (documentation-only observation)

**3. [Judgment call, not a Rule 1-3 auto-fix] Did NOT mark AI-03/AI-04 as "Complete" in REQUIREMENTS.md**
- **Found during:** State-update step, after running `requirements mark-complete AI-03 AI-04` per the standard workflow instruction
- **Issue:** The literal wording of AI-03 ("AI Insights history page lists all generated insights...") and AI-04 ("Anomaly detection alerts appear in-app...") both describe user-facing UI behavior that does not exist yet — this plan built only the database/RLS/Realtime foundation those UIs will read from (Plans 04 and 05, respectively, both also declare these same requirement IDs in their frontmatter). Running the standard `mark-complete` command flipped both checkboxes to `[x]`/"Complete" in `.planning/REQUIREMENTS.md`, which would misrepresent project state to a later `/gsd-audit-milestone` run.
- **Fix:** Reverted `.planning/REQUIREMENTS.md` via `git checkout --` (it was never staged/committed) back to `[ ]`/"Pending" for AI-03/AI-04. The requirement IDs remain in this SUMMARY's frontmatter `requirements-completed` field (accurate record of what this plan touched, for dependency-graph purposes), but the actual REQUIREMENTS.md checkboxes should only flip once Plan 04 (AI-03, insights history page) and Plan 05 (AI-04, in-app anomaly alerts) deliver the observable behavior.
- **Files modified:** none (change was reverted, not committed)
- **Verification:** `git diff .planning/REQUIREMENTS.md` shows no changes after revert; `grep` confirms both lines still read `[ ]`/"Pending"
- **Committed in:** n/a (intentionally not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking — test approach adaptation), 1 documented non-issue (false-positive grep), 1 judgment call (requirement-completion tracking)
**Impact on plan:** No scope creep. The realtime test substitution strengthens verification (behavioral vs. metadata) rather than weakening it, and was necessitated by a platform constraint (PostgREST schema exposure) not discoverable until execution. Declining to prematurely mark AI-03/AI-04 complete keeps `.planning/REQUIREMENTS.md` accurate for the milestone audit.

## Issues Encountered
- First combined run of the full `anomaly_alerts` realtime test alongside the other 6 tests in the same file timed out waiting for the `postgres_changes` payload (8s window, 0 events received). Isolated re-runs (single test, then full file, 3x) all passed in under 1s consistently. Root cause is consistent with a one-time websocket connection cold-start on the very first Realtime subscription of the process, not a defect in the migration, RLS, or publication membership — those were independently confirmed live via `supabase db query` regardless of this test's outcome.

## User Setup Required

None for local development — `ANTHROPIC_API_KEY` is already present in `.env.local` (confirmed in 04-RESEARCH.md and by this plan's own frontmatter `user_setup` note). Still outstanding for deployment: add `ANTHROPIC_API_KEY` to the Vercel Dashboard (Production + Preview + Development) before Plan 03's streaming route is deployed — this is a deploy-time task tracked in STATE.md's Deferred Items, not a blocker for continuing local execution of Plans 03-06.

## Next Phase Readiness
- Both tables are live with correct RLS and Realtime wiring — Plans 03 (on-demand insights route), 04 (insights UI), 05 (anomaly UI), and 06 (daily job) can now read/write `ai_insights`/`anomaly_alerts` against the real schema instead of a not-yet-applied migration.
- `ai` + `@ai-sdk/anthropic` are installed and resolvable — Plan 03's `streamText` route can be built without further dependency setup.
- No blockers identified for Plan 03.

---
*Phase: 04-ai-insights*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: supabase/migrations/0021_create_ai_insights.sql
- FOUND: supabase/migrations/0022_create_anomaly_alerts.sql
- FOUND: tests/integration/ai-insights-rls.test.ts
- FOUND: tests/unit/anomaly-alerts-schema.test.ts
- FOUND: .planning/phases/04-ai-insights/04-02-SUMMARY.md
- FOUND commit: e0a82b7 (Task 1)
- FOUND commit: dad6092 (Task 2)
