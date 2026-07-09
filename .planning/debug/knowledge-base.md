# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## auth-hook-wired-to-wrong-function — Supabase Custom Access Token Hook pointed at unrelated Edge Function instead of the project's Postgres function
- **Date:** 2026-07-09
- **Error patterns:** app_metadata, role, tenant_slug, tenant_id, visualizador, slug, custom_access_token_hook, no_membership, JWT, Edge Function, hook_custom_access_token_uri, pg-functions
- **Root cause:** The live Supabase project's Custom Access Token Auth Hook (Dashboard -> Authentication -> Hooks) was configured to call a deployed HTTP Edge Function (`custom-access-token`, unrelated boilerplate not present in repo git history) instead of the project's own `pg-functions://postgres/public/custom_access_token_hook`. The Edge Function only echoed pre-existing `app_metadata` (never queried `tenant_users`/`agency_users`), referenced nonexistent `tenants.plan`/`tenants.trial_ends_at` columns (silent no-op), and wrote the tenant slug under `slug` instead of `tenant_slug`. Every consumer of role/tenant identity reads JWT `app_metadata` with no DB fallback, so real `tenant_admin`/`viewer` users were locked out (redirected to `/login?error=no_membership`).
- **Fix:** In Supabase Dashboard -> Authentication -> Hooks -> Custom Access Token, switch the hook selection from the Edge Function back to the Postgres function `public.custom_access_token_hook`. No code changes needed if that Postgres function is already correctly implemented (verify via migrations first). Confirm via Management API `GET /v1/projects/{ref}/config/auth` -> `hook_custom_access_token_uri` should equal `pg-functions://postgres/public/{function_name}`, and via a live sign-in test decoding the returned JWT.
- **Files changed:** none (live Supabase project configuration change only, no repo files)
---

## test-tenants-leaking-into-production — RLS integration tests silently fail to clean up fixtures, leaking test tenants into the live tenants table
- **Date:** 2026-07-09
- **Error patterns:** permission denied for table tenants, 42501, afterAll, serviceClient, signInWithPassword, service_role, orphan tenant rows, rls-test-tenant, rls-agency-tenant, switcher, cleanup, cascade
- **Root cause:** `tests/agency-rls.test.ts` (4 call sites) and `tests/integration/sync-jobs-rls.test.ts` (1 call site) called `serviceClient.auth.signInWithPassword(...)` directly on the same module-scoped Supabase client instance also used as the service_role cleanup client in `afterAll`. `@supabase/supabase-js` tracks a live auth session per client instance and uses it as the PostgREST `Authorization` bearer for all subsequent requests from that instance — signing in as a test user permanently overwrote `serviceClient`'s effective role from service_role to that authenticated test user for the rest of the file. Every `afterAll` delete then failed with 42501 permission-denied (no DELETE grant for `authenticated` on `tenants`/`agencies`), and because neither `afterAll` block ever checked `{ error }`, the failure was completely silent on every run — leaking test fixture rows into the live `tenants` table on every test run that reached one of these 5 call sites.
- **Fix:** Route every test-user sign-in through a disposable, throwaway `createClient(...)` instance instead of the shared `serviceClient`, so `serviceClient`'s session is never mutated and remains service_role for `afterAll`. Added explicit `{ error }` checking + `console.error` logging on every `afterAll` delete/deleteUser call in both files so future cleanup failures are loud instead of silent. Also purged the 36 already-leaked orphan tenant rows from the live table (verified each against expected test-fixture name patterns before deleting; auth.users test accounts intentionally left untouched per user decision).
- **Files changed:** tests/agency-rls.test.ts, tests/integration/sync-jobs-rls.test.ts
---
