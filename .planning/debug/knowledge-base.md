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
