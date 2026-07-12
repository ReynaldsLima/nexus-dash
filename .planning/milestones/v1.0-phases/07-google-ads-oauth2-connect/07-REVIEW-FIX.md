---
phase: 07-google-ads-oauth2-connect
fixed_at: 2026-07-11T21:59:10.749Z
review_path: .planning/phases/07-google-ads-oauth2-connect/07-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-07-11T21:59:10.749Z
**Source review:** .planning/phases/07-google-ads-oauth2-connect/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warning — Info findings excluded per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Open redirect via unvalidated `tenantSlug` in OAuth error/success redirects

**Files modified:** `lib/google-ads/oauth-state.ts`, `app/api/google-ads/connect/route.ts`, `app/api/google-ads/callback/route.ts`
**Commit:** `be3369e`
**Applied fix:** Added an exported `safeTenantSlug()` helper in `lib/google-ads/oauth-state.ts` (regex `^[a-z0-9-]{2,50}$`, mirroring the DB CHECK constraint on `tenants.slug` from migration `0002_create_tenants.sql`, rather than the reviewer's suggested DNS-label-style regex, so legitimate hyphen-leading/trailing slugs already allowed by the schema are not rejected). `connect/route.ts`'s `redirectSlug` now goes through `safeTenantSlug()` before being used to build the error redirect (falls back to the existing JSON 400 response when invalid). `callback/route.ts`'s `settingsRedirect()` now validates `tenantSlug` from the signed state the same way, falling back to a root redirect if somehow invalid. Verified via existing unit test suite (21/21 passing at this stage, no test changes required since valid test slugs like `acme` already conform to the new regex).

### WR-01: Callback route writes privileged data with no session/authentication check

**Files modified:** `app/api/google-ads/callback/route.ts`, `tests/unit/google-ads-callback-route.test.ts`
**Commit:** `d66f698`
**Applied fix:** Added a session check (`createClient()` + `supabase.auth.getUser()`) as step 0 of the callback route, before state verification — mirrors `connect/route.ts`'s existing pattern. Unauthenticated requests now redirect to `/` with no Vault write and no `ad_accounts` upsert. Updated `tests/unit/google-ads-callback-route.test.ts` to mock `@/lib/supabase/server` (previously unmocked, since the route had no auth dependency before this fix) with a default authenticated user so all pre-existing scenarios continue to exercise the state/token-exchange logic unaffected, and added a new test case (`no authenticated session (WR-01) → redirect to / (root)...`) asserting the unauthenticated path.

### WR-02: Unhandled JSON parse exception during token exchange

**Files modified:** `app/api/google-ads/callback/route.ts`
**Commit:** `3a80a80`
**Applied fix:** Wrapped `tokenRes.json()` in a `try/catch` so a non-JSON or truncated `ok:true` response from Google's token endpoint redirects to `?google_error=token_exchange_failed` instead of throwing an unhandled 500, consistent with the route's own "always redirect to Settings" design goal. No existing test exercised this throw path, so none needed updating; verified via Tier 1 (re-read) + Tier 2 (unit suite green).

### WR-03: No format/existence validation of `tenantId`/`tenantSlug` for the `super_admin` path

**Files modified:** `app/api/google-ads/connect/route.ts`, `tests/unit/google-ads-connect-route.test.ts`
**Commit:** `c79ec06`
**Applied fix:** Replaced the bare truthiness check in the `super_admin` branch with `z.uuid().safeParse(...)` for `tenantId` and `safeTenantSlug(...)` (the CR-01 helper) for `tenantSlug`; either failing now returns `errorRedirect('missing_tenant')` immediately instead of producing a validly-signed state that would only fail later at the callback's `ad_accounts` FK constraint. Updated the existing `super_admin + valid customerId` happy-path test to use a proper UUID-formatted `tenantId` (was the placeholder string `tenant-uuid-1`, which is not a valid UUID and would otherwise now be rejected) and added a new test asserting a malformed `tenantId` redirects with `google_error=missing_tenant`.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-11T21:59:10.749Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
