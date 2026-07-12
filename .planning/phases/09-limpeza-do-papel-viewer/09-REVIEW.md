---
phase: 09-limpeza-do-papel-viewer
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - lib/stores/tenant-store.tsx
  - proxy.ts
  - components/tenants/tenant-switcher.tsx
  - app/api/meta-ads/connect/route.ts
  - tests/middleware.test.ts
  - tests/unit/google-ads-connect-route.test.ts
  - tests/unit/insights-generate-route.test.ts
  - tests/unit/leads-status-route.test.ts
  - tests/unit/leads-get-route.test.ts
  - tests/unit/leads-chat-route.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-07-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the `viewer`-role cleanup changes across the auth/routing layer (`proxy.ts`, `lib/stores/tenant-store.tsx`, `components/tenants/tenant-switcher.tsx`), the `meta-ads/connect` API route, and five unit test files. The `viewer` role has been fully removed from all reviewed application-layer files (confirmed via grep — no remaining references in `proxy.ts` or `tenant-store.tsx`), and `app/api/meta-ads/connect/route.ts` correctly derives `tenantId` server-side from verified JWT claims for non-`super_admin` callers, never logs the Meta token, and keeps the Vault write on the service-role client — good security hygiene.

No critical (security-bypass-class) issues were found. However, `proxy.ts` has a real correctness bug in its JWT claim decoder (`atob()` used on a base64url string, inconsistent with the correct pattern already established elsewhere in the codebase in `lib/google-ads/oauth-state.ts`), and its route matcher does not exclude `/api/*`, which makes the explicit 401 handling in API routes effectively unreachable for the common "no session" case in production. `tests/middleware.test.ts` also does not actually exercise `proxy.ts`'s logic, which masks both of these issues from the test suite.

## Warnings

### WR-01: `decodeJwtClaims` uses `atob()` instead of base64url-safe decoding

**File:** `proxy.ts:10-20`
**Issue:** JWT header/payload segments are base64url-encoded per RFC 7519 (using `-`/`_` in place of `+`/`/`, no padding). `atob()` implements the WHATWG base64 (RFC 4648 standard alphabet) decoder, which throws `InvalidCharacterError` when it encounters `-` or `_`. Any access token whose `app_metadata` payload segment happens to contain either character will fail to decode, the `catch {}` swallows the error silently, `claims` becomes `null`, and the request falls through to the "no role" branch — redirecting an otherwise validly authenticated user to `/login?error=no_membership` (or blocking `/tenants`/`/agencies` access). This is intermittent and payload-dependent, so it can pass testing/staging and then fail in production for specific users/sessions. The codebase already has the correct pattern elsewhere:
```ts
// lib/google-ads/oauth-state.ts:70
const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
```
**Fix:** Decode using the same base64url-aware method, e.g.:
```ts
function decodeJwtClaims(token: string | undefined): AppMetadata | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    return (JSON.parse(json)?.app_metadata ?? null) as AppMetadata | null
  } catch {
    return null
  }
}
```
(`Buffer` is available in the Node.js middleware/proxy runtime; if this must run on Edge runtime without `Buffer`, convert manually: `payload.replace(/-/g, '+').replace(/_/g, '/')` plus `=` padding before calling `atob`.)

### WR-02: Middleware matcher does not exclude `/api/*`, making route-level 401 handling unreachable for unauthenticated requests

**File:** `proxy.ts:107-111` (cross-referenced against `app/api/meta-ads/connect/route.ts:38-40`)
**Issue:** `config.matcher` only excludes `_next/static`, `_next/image`, `favicon.ico`, and a handful of static image extensions — it does not exclude `/api/*`. Since `PUBLIC_PATHS` only contains `/login`, any unauthenticated request to an API route (e.g. `POST /api/meta-ads/connect`) is intercepted by `proxy()` before the route handler runs, and returns a `307` redirect to `/login` instead of the JSON `401` the route itself is written to return. In practice this means:
- The route's own `if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` (and the equivalent checks unit-tested in `tests/unit/google-ads-connect-route.test.ts`, `tests/unit/insights-generate-route.test.ts`, `tests/unit/leads-status-route.test.ts`, `tests/unit/leads-get-route.test.ts`, `tests/unit/leads-chat-route.test.ts`) is dead code for the "no session at all" case — it can only be reached if `getUser()` returns a user in the middleware but `null` in the route (a narrow race), not the general unauthenticated case these tests assume.
- A `fetch()`-based API client that expects a JSON error body on 401 will instead receive (after following the redirect) an HTML login page with status 200, and `res.json()` will throw.
**Fix:** Exclude `/api` from the matcher, or branch inside `proxy()` to return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` for `pathname.startsWith('/api/')` instead of redirecting:
```ts
if (!user) {
  if (PUBLIC_PATHS.has(pathname)) return supabaseResponse
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}
```

### WR-03: Middleware does not enforce tenant-slug ownership on generic `/[tenantSlug]/*` routes

**File:** `proxy.ts:79-93`
**Issue:** Role-based path guards exist only for `/tenants` and `/agencies`. There is no check that a `tenant_admin` (or `agency` without a grant) navigating directly to `/{someOtherTenantSlug}/dashboard` (or any other tenant-scoped page) actually owns that slug per their JWT `tenant_slug`/`agency_id` claim. The reviewed API routes (`leads`, `leads/status`, `leads/chat`) do perform this scoping check server-side (confirmed via their test suites — e.g. `tests/unit/leads-get-route.test.ts:82-88` expects 403 on tenant-slug mismatch), so the data itself is likely protected, but the middleware provides no defense-in-depth at the routing layer — a mismatched-tenant page shell could still render before any data fetch rejects it, and any future page that fetches data without re-checking ownership would have no other backstop.
**Fix:** Add a generic guard in `proxy()` for the first path segment when it doesn't match a known static route, comparing it against the caller's own `tenant_slug`/`agency_id` claim (with an explicit allowlist/exception for agency users who are permitted to view multiple tenants), so ownership is enforced once centrally rather than being reimplemented per route.

### WR-04: `tests/middleware.test.ts` does not exercise `proxy.ts`'s actual code

**File:** `tests/middleware.test.ts:1-74`
**Issue:** `proxy()` and its internal `decodeJwtClaims` are not imported anywhere in this test file — `decodeJwtClaims` isn't even exported from `proxy.ts`. Instead, the test defines its own local `decodeAppMetadata` function that reimplements (and, notably, does **not** reproduce) the base64-vs-base64url decoding behavior of the real function (it uses `Buffer.from(payload, 'base64')`, whose Node.js implementation tolerates URL-safe characters, unlike the real `atob()`-based implementation — see WR-01). Several test names describe middleware routing behavior that is never actually asserted, e.g.:
```ts
it('redirects super_admin from / to /tenants', () => {
  const token = makeToken({ role: 'super_admin', tenant_id: null, tenant_slug: null })
  const claims = decodeAppMetadata(token)
  expect(claims?.role).toBe('super_admin')   // never invokes proxy(), never checks a redirect
})
```
No test in this file calls `proxy(request)` or asserts on `res.status` / `res.headers.get('location')`. This gives false confidence that `proxy.ts`'s redirect/guard logic is covered, and is exactly why WR-01 (a real decoding bug in the production function) went undetected.
**Fix:** Import and invoke the actual `proxy` export from `proxy.ts` with a constructed `NextRequest` (mocking `createServerClient`/`supabase.auth.getUser()`/`getSession()` as needed), and assert on the resulting `NextResponse` status and `location` header for each described scenario. At minimum, add a decode-only test that feeds a payload containing `-`/`_` through the *real* `decodeJwtClaims` (would require exporting it, even if only for testing) to catch regressions like WR-01.

## Info

### IN-01: Leftover scaffold test with no assertions of value

**File:** `tests/unit/insights-generate-route.test.ts:116-120`
**Issue:** `describe('insights-generate-route scaffold sanity')` contains only `expect(true).toBe(true)` — a placeholder left over from initial test-file scaffolding.
**Fix:** Remove this `describe` block; the file already has a full, meaningful test suite above it.

### IN-02: No fetch timeout on outbound Meta Graph API calls in `meta-ads/connect`

**File:** `app/api/meta-ads/connect/route.ts:101-133`
**Issue:** Both the `/me` token-validation call and the ads-account permission call use bare `fetch()` with no `AbortSignal` timeout. A slow or hanging response from `graph.facebook.com` will hold the serverless function open for its full duration with no way to fail fast, and there is no rate limiting on this route (unlike `/api/leads/chat`, which documents a 20/5min per-user limiter).
**Fix:** Add a timeout, e.g. `fetch(meUrl, { signal: AbortSignal.timeout(8000) })`, and consider a lightweight per-user rate limit similar to the one used in `leads/chat` given this route also makes outbound calls to a third-party API based on user-supplied tokens.

### IN-03: Inconsistent indentation around the top-level `try` block

**File:** `proxy.ts:25-26`
**Issue:** `try {` on line 25 is followed by `let supabaseResponse = ...` on line 26 at the same indentation level as the `try` keyword itself, rather than one level deeper. Cosmetic only, but reduces readability of an already-large function wrapped entirely in one try/catch.
**Fix:** Re-indent the block body one level deeper (or run the project's formatter) so the try/catch scope is visually clear.

### IN-04: `TenantSwitcher`'s `role` prop type defeats union exhaustiveness

**File:** `components/tenants/tenant-switcher.tsx:13`
**Issue:** `role: 'super_admin' | 'tenant_admin' | 'agency' | string | null` — the `| string` member widens the whole union back to `string | null` for type-checking purposes, so a typo'd role value (e.g. `'super-admin'`) would type-check fine and silently fall through to `return null` with no compiler warning.
**Fix:** Drop the `| string` fallback and reuse the `Role` type already defined in `lib/stores/tenant-store.tsx` (minus `'none' | null` handling as needed), so a mismatched literal is caught at compile time.

### IN-05: Duplicate tenant shape definitions (`Tenant` vs `TenantOption`)

**File:** `lib/stores/tenant-store.tsx:6-11`, `components/tenants/tenant-switcher.tsx:5-10`
**Issue:** `Tenant` (in the store) and `TenantOption` (in the switcher component) declare an identical `{ id, name, slug, active }` shape independently. Any future change to one (e.g. adding a field) risks silent drift between the two.
**Fix:** Export `Tenant` from `lib/stores/tenant-store.tsx` and import it directly in `tenant-switcher.tsx` (or move the shared shape to a common `types` module) instead of redeclaring it as `TenantOption`.

---

_Reviewed: 2026-07-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
