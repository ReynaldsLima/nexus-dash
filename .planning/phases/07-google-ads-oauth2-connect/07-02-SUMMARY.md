---
phase: 07-google-ads-oauth2-connect
plan: 02
subsystem: google-ads-oauth2
tags: [oauth2, hmac, nodejs-crypto, route-handler, google-ads]

# Dependency graph
requires:
  - phase: 07-google-ads-oauth2-connect
    provides: "Plan 01's RED specs (tests/unit/oauth-state.test.ts, tests/unit/google-ads-connect-route.test.ts) as the executable contract this plan turns GREEN"
provides:
  - "lib/google-ads/oauth-state.ts — signState/verifyState HMAC-SHA256 state helper, reusable by Plan 03's callback route"
  - "GET /api/google-ads/connect — authorization-request entry point of the OAuth2 flow"
  - "GOOGLE_OAUTH_STATE_SECRET set in .env.local; GOOGLE_ADS_CLIENT_ID/SECRET documented (empty, D-03 blocker)"
affects: [07-03-PLAN, 07-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OAuth state signed with node:crypto HMAC-SHA256 (no JWT library) — discriminated verifyState result (null vs {payload, expired}) so callers can distinguish tampering from mere staleness"
    - "Top-level-navigation Route Handler error convention: every failure after the no-user case redirects to /{tenantSlug}/settings?google_error=<code> instead of returning JSON, mirroring D-04"

key-files:
  created:
    - lib/google-ads/oauth-state.ts
    - app/api/google-ads/connect/route.ts
  modified:
    - .env.local
    - .env.test.example

key-decisions:
  - "verifyState returns a discriminated result: null only for bad-signature/malformed/tampered input; { payload, expired: true } for a validly-signed-but-stale state, so the callback (Plan 03) can recover tenantSlug for an inline settings error even after expiry"
  - "tenant_admin's authoritative tenantId/tenantSlug always come from getClaims() app_metadata, never the query string — the query tenantSlug is used ONLY to build the error-redirect target (T-07-02 Elevation-of-Privilege mitigation)"

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-07-11
---

# Phase 07 Plan 02: Google Ads OAuth2 Connect — State Helper + Authorization Route Summary

**HMAC-SHA256-signed OAuth `state` helper (node:crypto only) plus `GET /api/google-ads/connect`, the authorization-request entry point that gates auth/role/tenant-scope then 307-redirects to Google's consent screen with `access_type=offline`+`prompt=consent` always set.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-11
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `lib/google-ads/oauth-state.ts` — `signState`/`verifyState` using `node:crypto`'s `createHmac`/`randomBytes`/`timingSafeEqual` exclusively (no JWT library). `verifyState` returns `null` for bad-signature/tampered/malformed input and `{ payload, expired: true }` (payload preserved) for a validly-signed-but-stale (>10min) state — the D-04 recovery path that lets the callback route redirect to the correct tenant's Settings page even after expiry. `tests/unit/oauth-state.test.ts` fully GREEN (6/6).
- `GOOGLE_OAUTH_STATE_SECRET` generated via `openssl rand -hex 32` and added to `.env.local` (gitignored, real value); `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET` documented as empty placeholders pending the user's Google Cloud OAuth client (D-03 infra blocker, same class as the Phase 2 Developer Token). `.env.test.example` updated with fake test values for all three vars.
- `app/api/google-ads/connect/route.ts` — `GET` handler mirroring `app/api/meta-ads/connect/route.ts`'s auth/role/`getClaims()` sequence exactly. Auth: 401 JSON only when there's no user (documented limitation — `proxy.ts` already redirects unauthenticated users to `/login` before this handler runs). Every other failure (role/validation/missing-tenant) redirects to `/${tenantSlug}/settings?google_error=<code>` instead of raw JSON, since the route is entered via a top-level browser navigation (D-04). For `tenant_admin`, the authoritative `tenantId`/`tenantSlug` are resolved from `getClaims()` app_metadata — the query string's `tenantSlug`/`tenantId` are used only to build the error-redirect target, never for authorization (T-07-02). Customer ID validated/normalized to digits-only via Zod (Pitfall 4). `redirect_uri` computed from `req.nextUrl.origin` as a single source of truth (Pitfall 1). On success, 307-redirects to `https://accounts.google.com/o/oauth2/v2/auth` with `access_type=offline`, `prompt=consent`, `scope=...adwords`, and the signed state. `tests/unit/google-ads-connect-route.test.ts` fully GREEN (8/8).
- No new npm dependency — `node:crypto`, `zod/v4` (existing), and native `fetch`/`NextResponse` only, per the plan's success criteria.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/google-ads/oauth-state.ts** - `b1a17cc` (feat)
2. **Task 2: Add GOOGLE_OAUTH_STATE_SECRET to .env.local and .env.test.example** - `4769157` (chore)
3. **Task 3: Create app/api/google-ads/connect/route.ts** - `be4ed9f` (feat)

## Files Created/Modified

- `lib/google-ads/oauth-state.ts` - `signState`/`verifyState` HMAC-SHA256 state helper (67 lines)
- `app/api/google-ads/connect/route.ts` - `GET` handler, auth/role/scope gate + redirect to Google (101 lines)
- `.env.local` - Added `GOOGLE_OAUTH_STATE_SECRET` (real generated value), `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET` (empty, pending user setup)
- `.env.test.example` - Added fake test placeholders for all three new env vars

## Decisions Made

- Followed the plan's literal reference implementation for both `oauth-state.ts` and the route verbatim — no structural deviation from the provided code blocks.
- Confirmed `.env.local` is gitignored (`.gitignore:24 .env*.local`) — the real secret was never staged/committed; only `.env.test.example`'s fake values were committed to git.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` is clean apart from the 2 pre-existing unrelated `tests/integration/vault-rpc.test.ts` errors and Plan 03's still-in-scope `tests/unit/google-ads-callback-route.test.ts` module-not-found errors (expected — that route doesn't exist until Plan 03). `npm test` (full suite): 222 passed / 1 skipped / 5 todo, with the 7 `google-ads-callback-route.test.ts` failures being the intentional Wave 0 RED coupling documented in Plan 01's summary (turns GREEN only after Plan 03) — zero regressions elsewhere. `npm run build` succeeds; `/api/google-ads/connect` appears in the build output route list.

## User Setup Required

**Deferred infrastructure blocker (D-03), same class as the Phase 2 Developer Token — code is complete and correct without it; the flow only runs live once these exist:**

1. **Create a Google Cloud OAuth Client (Web application)** in Google Cloud Console → APIs & Services → Credentials, with scope `https://www.googleapis.com/auth/adwords`.
2. **Register the exact redirect URI** `{production-origin}/api/google-ads/callback` (byte-for-byte, no trailing slash) plus `http://localhost:3000/api/google-ads/callback` for local dev, under the new OAuth client's Authorized redirect URIs.
3. **Set env vars in Vercel** (Production + Preview + Development):
   - `GOOGLE_ADS_CLIENT_ID` — from the new OAuth client
   - `GOOGLE_ADS_CLIENT_SECRET` — from the new OAuth client
   - `GOOGLE_OAUTH_STATE_SECRET` — use the SAME value already generated into local `.env.local` (`openssl rand -hex 32`), so state signatures are valid across environments where relevant, or generate a fresh Vercel-only value — either is acceptable since only this app ever verifies its own signed state.

None of this blocks code review or the automated test suite; it only blocks a live end-to-end manual verification of the OAuth redirect (Plan 04's checkpoint).

## Next Phase Readiness

- Plan 03 can now implement `app/api/google-ads/callback/route.ts` against `tests/unit/google-ads-callback-route.test.ts`, importing `verifyState` from this plan's `lib/google-ads/oauth-state.ts` (already satisfied — the callback test file's static import of `signState` now resolves).
- Plan 04 (UI wiring + live checkpoint) still depends on the user completing the Google Cloud OAuth Client setup documented above.
- No blockers introduced by this plan.

## Self-Check: PASSED

Both created files verified present on disk (`lib/google-ads/oauth-state.ts`, `app/api/google-ads/connect/route.ts`); all 3 task commit hashes (`b1a17cc`, `4769157`, `be4ed9f`) verified present in git history via `git log --oneline -5`.

---
*Phase: 07-google-ads-oauth2-connect*
*Completed: 2026-07-11*
