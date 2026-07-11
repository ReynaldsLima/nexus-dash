---
phase: 07-google-ads-oauth2-connect
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/[tenant-slug]/settings/page.tsx
  - app/api/google-ads/callback/route.ts
  - app/api/google-ads/connect/route.ts
  - components/settings/google-ads-form.tsx
  - lib/google-ads/oauth-state.ts
  - tests/unit/google-ads-callback-route.test.ts
  - tests/unit/google-ads-connect-route.test.ts
  - tests/unit/oauth-state.test.ts
  - .env.test.example
findings:
  critical: 1
  warning: 3
  info: 7
  total: 11
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-07-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Google Ads OAuth2 "Connect" flow (settings page wiring, `connect`/`callback` route handlers, signed-state helper, form component, and unit tests). The signed-state design (HMAC-SHA256, `timingSafeEqual`, TTL-based expiry, discriminated expired-vs-invalid result) is sound and the tenant-scoping logic for `tenant_admin` correctly sources identity from verified JWT claims rather than the query string (mitigating the elevation-of-privilege threat the code's own comments call out).

However, one **critical open-redirect vulnerability** was found: both `errorRedirect` in `connect/route.ts` and `settingsRedirect` in `callback/route.ts` build a redirect `Location` from an unvalidated `tenantSlug` value. A `tenantSlug` such as `/evil.com` (URL-encoded `%2Fevil.com`) turns `new URL('/' + tenantSlug + '/settings', origin)` into an absolute URL on `evil.com` — reachable by any authenticated user (any role) via the `forbidden` or `invalid_customer_id` error branches, with no need to touch the actual Settings UI (a crafted link straight to `/api/google-ads/connect?...` is enough). This should be fixed before shipping.

Additional warnings cover a missing session check in the callback's privileged write path (defense-in-depth), an unhandled JSON-parse exception in the token exchange, and missing format validation of `tenantId`/`tenantSlug` for the `super_admin` path. Info-level items cover a dead `nonce` field, secret-strength validation, minor UI/test polish, and small duplication.

## Critical Issues

### CR-01: Open redirect via unvalidated `tenantSlug` in OAuth error/success redirects

**File:** `app/api/google-ads/connect/route.ts:45-51`, propagated via `app/api/google-ads/callback/route.ts:26-31`

**Issue:**
`errorRedirect` in `connect/route.ts` builds the redirect target directly from the raw `tenantSlug` query parameter with only a truthiness check:

```ts
const redirectSlug = req.nextUrl.searchParams.get('tenantSlug') ?? ''
function errorRedirect(code: string) {
  if (!redirectSlug) return NextResponse.json({ error: code }, { status: 400 })
  const url = new URL(`/${redirectSlug}/settings`, req.nextUrl.origin)
  url.searchParams.set('google_error', code)
  return NextResponse.redirect(url)
}
```

Per the WHATWG URL spec, a path that begins with `//` is parsed as a network-path (protocol-relative) reference, which replaces the *host* while keeping the base's scheme. Confirmed locally:

```
node -e "console.log(new URL('/' + '/evil.com' + '/settings', 'http://localhost:3000').href)"
// -> http://evil.com/settings
```

So a request with `tenantSlug=%2Fevil.com` (decodes to `/evil.com`) causes `new URL('//evil.com/settings', origin)` → `http://evil.com/settings`. This is reachable by **any authenticated user regardless of role**:
- `role === 'viewer'` hits `errorRedirect('forbidden')` at step 3 (before any tenant-admin/super-admin check).
- An invalid `customerId` hits `errorRedirect('invalid_customer_id')` at step 4.

No special privilege is required — a direct link to `/api/google-ads/connect?tenantSlug=%2Fevil.com&customerId=x` from any logged-in session (any role) is sufficient. This is a classic open-redirect (CWE-601), which is particularly dangerous adjacent to an OAuth consent flow (ideal for phishing pages that appear to originate from the trusted app domain).

The same unvalidated value flows into the signed `state` for the `super_admin` path (`tenantSlug = req.nextUrl.searchParams.get('tenantSlug')` at connect/route.ts:73, no format check) and is later used verbatim to build `settingsRedirect` in `callback/route.ts:26-31`, so the callback's redirect inherits the same risk whenever a `super_admin` request (or state forged before validation is added) carries a malicious slug.

**Fix:** Validate the slug format before using it to build any redirect, in both places:

```ts
// shared helper, e.g. lib/google-ads/oauth-state.ts or a small utils module
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

function safeTenantSlug(raw: string | null): string | null {
  return raw && SLUG_RE.test(raw) ? raw : null
}
```

```ts
// connect/route.ts
const redirectSlug = safeTenantSlug(req.nextUrl.searchParams.get('tenantSlug'))
function errorRedirect(code: string) {
  if (!redirectSlug) return NextResponse.json({ error: code }, { status: 400 })
  const url = new URL(`/${redirectSlug}/settings`, req.nextUrl.origin)
  url.searchParams.set('google_error', code)
  return NextResponse.redirect(url)
}
// also reject upfront at step 5 if tenantSlug (super_admin path) fails safeTenantSlug()
```

```ts
// callback/route.ts
function settingsRedirect(errCode?: string) {
  const safeSlug = safeTenantSlug(tenantSlug) ?? '' // fall back to root if somehow invalid
  const url = safeSlug
    ? new URL(`/${safeSlug}/settings`, req.nextUrl.origin)
    : new URL('/', req.nextUrl.origin)
  if (errCode) url.searchParams.set('google_error', errCode)
  else url.searchParams.set('google_connected', '1')
  return NextResponse.redirect(url)
}
```

## Warnings

### WR-01: Callback route writes privileged data with no session/authentication check

**File:** `app/api/google-ads/callback/route.ts:10-107`

**Issue:** Unlike `connect/route.ts` (which requires `supabase.auth.getUser()` to succeed before doing anything), the callback route never checks whether the incoming request is from an authenticated session. It trusts the signed `state` (HMAC-verified, TTL-bound) plus a one-time Google authorization `code` as the sole authority to perform a Vault secret write and an `ad_accounts` upsert via the service-role client (which bypasses RLS). If a valid `state`+`code` pair ever leaks outside the intended single browser round-trip (e.g., via browser history, a shared/kiosk machine, or a referrer leak from a third-party script loaded on an intermediate page), it can be redeemed by a completely unauthenticated party to link a Google Ads account to a tenant.

**Fix:** Add a defense-in-depth session check mirroring `connect/route.ts`, and consider also verifying the caller's role/tenant against the state's `tenantId` where feasible:

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.redirect(new URL('/', req.nextUrl.origin))
```

### WR-02: Unhandled JSON parse exception during token exchange

**File:** `app/api/google-ads/callback/route.ts:68-73`

**Issue:**
```ts
if (!tokenRes.ok) return settingsRedirect('token_exchange_failed') // never log the body (Pitfall 5)
const tokens = (await tokenRes.json()) as {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}
```
The `fetch` call itself is wrapped in try/catch, but `.json()` is not. If Google's token endpoint ever returns `ok: true` with a non-JSON or truncated body, `.json()` throws and the route handler crashes with an unhandled exception (500), contradicting the route's own design goal (stated in its comments) of *always* redirecting back to Settings rather than surfacing a raw error.

**Fix:**
```ts
let tokens: { access_token?: string; refresh_token?: string; expires_in?: number }
try {
  tokens = await tokenRes.json()
} catch {
  return settingsRedirect('token_exchange_failed')
}
```

### WR-03: No format/existence validation of `tenantId`/`tenantSlug` for the `super_admin` path

**File:** `app/api/google-ads/connect/route.ts:71-74`

**Issue:**
```ts
if (role === 'super_admin') {
  tenantId = req.nextUrl.searchParams.get('tenantId') ?? ''
  tenantSlug = req.nextUrl.searchParams.get('tenantSlug') ?? ''
  if (!tenantId || !tenantSlug) return errorRedirect('missing_tenant')
}
```
Only a truthiness check is performed — `tenantId` is not validated as a UUID and `tenantSlug` is not validated against a slug format (see CR-01). A malformed/nonexistent `tenantId` will still produce a validly-signed `state`, and only fails much later at the callback's `ad_accounts` upsert (via the `tenant_id` FK constraint), surfacing an opaque `save_failed` error instead of a clear, early `invalid_tenant` message.

**Fix:** Validate with Zod at the point of resolution, consistent with how `customerId` is already validated:
```ts
const tenantId = z.uuid().safeParse(req.nextUrl.searchParams.get('tenantId')).data
const tenantSlug = safeTenantSlug(req.nextUrl.searchParams.get('tenantSlug'))
if (!tenantId || !tenantSlug) return errorRedirect('missing_tenant')
```

## Info

### IN-01: `nonce` field is generated but never checked (misleading "replay defense" comment)

**File:** `lib/google-ads/oauth-state.ts:29-40`
**Issue:** `signState` includes a `nonce: randomBytes(16).toString('hex')` field in the payload, and the file's header comment attributes "CSRF/replay defense" to the state mechanism (T-07-01). However, `verifyState` never records or checks the nonce for single-use — the only actual replay mitigation is the 10-minute TTL (`expired` flag) plus reliance on Google's authorization `code` being one-time-use. A state (and a still-unused code) could in principle be replayed within the TTL window.
**Fix:** Either implement single-use tracking (e.g., a short-lived server-side set/cache keyed by nonce, checked and marked-used in `verifyState`), or update the comment to accurately describe the nonce as unused/reserved-for-future-use so the security model isn't overstated.

### IN-02: No minimum-length/entropy check on `GOOGLE_OAUTH_STATE_SECRET`

**File:** `lib/google-ads/oauth-state.ts:19-23`
**Issue:** `secret()` only checks that the env var is set, not that it meets a minimum length (e.g., 32 bytes) suitable for HMAC-SHA256. A short/weak secret configured in production would materially reduce the security of the signed state.
**Fix:**
```ts
function secret(): string {
  const s = process.env.GOOGLE_OAUTH_STATE_SECRET
  if (!s || s.length < 32) throw new Error('GOOGLE_OAUTH_STATE_SECRET must be set and at least 32 chars')
  return s
}
```

### IN-03: Unnecessary `useState` for a value that's never updated

**File:** `components/settings/google-ads-form.tsx:93`
**Issue:** `const [connectionStatus] = useState<...>(initialStatus)` never calls its setter, making it functionally equivalent to a plain constant.
**Fix:** `const connectionStatus = initialStatus` (drop the `useState` import if unused elsewhere).

### IN-04: No success feedback for a completed OAuth connection

**File:** `components/settings/google-ads-form.tsx:94-96`
**Issue:** The component reads `google_error` from search params and shows an inline error banner, but there is no corresponding handling of `google_connected=1` (set by `callback/route.ts` on success) to show a confirmation message — the user only sees the (already-present) status badge update after the page remounts.
**Fix:** Add a parallel success banner keyed off `searchParams.get('google_connected')`, mirroring the error banner pattern.

### IN-05: Duplicated status-badge logic

**Files:** `app/[tenant-slug]/settings/page.tsx:73-85` (`ChannelStatusBadge`) and `components/settings/google-ads-form.tsx:62-84` (`StatusBadge`)
**Issue:** Both components implement near-identical badge-by-status logic. This is a maintenance risk — a future style/copy change would need to be applied in (at least) two places (plus likely a third in `meta-ads-form.tsx`).
**Fix:** Extract a single shared `ConnectionStatusBadge` component (e.g., under `components/settings/`) and reuse it from the page and both form components.

### IN-06: Missing test coverage for a couple of error paths

**Files:** `tests/unit/google-ads-callback-route.test.ts`, `tests/unit/google-ads-connect-route.test.ts`
**Issue:** No test exercises the `ad_accounts` upsert failure branch (`google_error=save_failed`) in the callback route, and no test exercises the `super_admin` path with `tenantId` present but `tenantSlug` missing (or vice versa) in the connect route.
**Fix:** Add cases mirroring the existing Vault-failure test:
```ts
it('ad_accounts upsert fails → redirect with google_error=save_failed', async () => {
  mockState.upsertError = { message: 'upsert failed' }
  // ... assert loc contains 'google_error=save_failed'
})
```

### IN-07: Expired-state check masks Google's own error reason when both occur together

**File:** `app/api/google-ads/callback/route.ts:39-43`
**Issue:** The `expired` check runs before the `?error=` (e.g. `access_denied`) check. If a user takes >10 minutes on Google's consent screen *and* ultimately declines consent, the response is `state_expired` rather than the more accurate `access_denied`. Likely low-impact, but worth a one-line comment confirming this ordering is an intentional tradeoff (or swap the checks) since both are D-04-driven UX decisions.
**Fix:** Either document the intentional precedence, or check `googleError` first when `code`/`error` params are both present regardless of expiry.

---

_Reviewed: 2026-07-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
