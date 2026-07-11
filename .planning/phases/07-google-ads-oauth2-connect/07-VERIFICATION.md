---
phase: 07-google-ads-oauth2-connect
verified: 2026-07-11T19:15:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 07: Google Ads OAuth2 Connect Verification Report

**Phase Goal:** Tenant Admin can connect a Google Ads account to their tenant via OAuth2, mirroring the existing Meta Ads System User token connection flow.
**Verified:** 2026-07-11T19:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + merged PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tenant Admin can initiate a Google Ads OAuth2 flow from Settings and, after consent, see the connection reflected as active immediately | ✓ VERIFIED (code-complete; live round-trip deferred per D-03) | `GoogleAdsForm` top-level-navigates to `/api/google-ads/connect` (`components/settings/google-ads-form.tsx:115`); connect route redirects to Google with `access_type=offline`+`prompt=consent`+signed state; callback route upserts `ad_accounts` row with `active:true` and redirects to `/${tenantSlug}/settings?google_connected=1`. Live browser round-trip cannot run — no Google Cloud OAuth Client exists yet (D-03, documented infra blocker, same class as Phase 2's Developer Token). Tracked as Manual-Only in `07-VALIDATION.md`. |
| 2 | Refresh token stored in Supabase Vault, never in `ad_accounts` directly or logged | ✓ VERIFIED | `callback/route.ts:108-117` calls `service.rpc('create_or_update_vault_secret', ...)`; upsert at line 118-127 only writes `vault_secret_id`, never `refresh_token`/`access_token`. `grep -nE "refresh_token:\s"` returns nothing. No `console.log` anywhere in the route; `console.error` logs only `.message` (lines 115, 129). |
| 3 | `ad_accounts` gets a `google_ads` row per connected tenant, consistent with the `meta_ads` row shape | ✓ VERIFIED | `callback/route.ts:118-127` upserts `{ tenant_id, channel: 'google_ads', account_id, vault_secret_id, active: true }` with `onConflict: 'tenant_id,channel'` — same shape/RPC/onConflict as `app/api/meta-ads/connect/route.ts`. |
| 4 | signState/verifyState round-trips a payload; verifyState returns null on tampered/malformed but `{payload, expired:true}` on stale-but-valid state | ✓ VERIFIED | `lib/google-ads/oauth-state.ts` implements exactly this; `tests/unit/oauth-state.test.ts` 6/6 GREEN. |
| 5 | GET /api/google-ads/connect returns 401 JSON only for no-user; every other failure redirects to `/${tenantSlug}/settings?google_error=<code>`; tenant_admin scope from getClaims() not query | ✓ VERIFIED | `app/api/google-ads/connect/route.ts` implements this exactly; `tests/unit/google-ads-connect-route.test.ts` 9/9 GREEN (includes the WR-03 malformed-tenantId case added post-review). |
| 6 | On success, connect route 307-redirects to Google's auth endpoint with required params + signed state | ✓ VERIFIED | `connect/route.ts:92-108`; test asserts `access_type=offline`, `prompt=consent`, `scope` containing `adwords`, `state=`, `response_type=code`. |
| 7 | Callback rejects bad-signature state (→`/`) and expired-but-valid state (→`/${tenantSlug}/settings?google_error=state_expired`), both with zero writes; Google `?error=` also redirects; missing `refresh_token` is a hard error | ✓ VERIFIED | `callback/route.ts` implements all branches; `tests/unit/google-ads-callback-route.test.ts` 8/8 GREEN (includes new WR-01 no-session test added post-review). |
| 8 | Settings page renders a Google Ads card with Customer ID input + Connect button (replacing static placeholder), pre-fills Customer ID when connected (D-06), and surfaces `?google_error=` inline as `role="alert"` | ✓ VERIFIED | `app/[tenant-slug]/settings/page.tsx` imports/renders `<GoogleAdsForm tenantId tenantSlug initialStatus initialCustomerId>`; static "será habilitada após a aprovação do Developer Token" placeholder text is gone (`grep` confirms absence); `GoogleAdsForm` reads `initialCustomerId` as RHF default value and renders `role="alert"` `bg-destructive/10` block for all 10 error codes. |

**Score:** 8/8 truths verified (truth #1's live end-to-end browser round-trip is explicitly deferred per D-03 infra blocker — not a phase failure per this phase's own success-criteria wording and precedent set in Phase 2/4).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/google-ads/oauth-state.ts` | signState/verifyState HMAC helper, ≥45 lines | ✓ VERIFIED | 80 lines; exports `signState`, `verifyState`, `safeTenantSlug` (added post-review for CR-01); uses `node:crypto` only, `timingSafeEqual` present, no JWT lib. |
| `app/api/google-ads/connect/route.ts` | GET handler, ≥65 lines | ✓ VERIFIED | 109 lines; `runtime='nodejs'`; imports `signState`/`safeTenantSlug`; auth→role→customerId→tenant-scope→redirect sequence intact; WR-03 UUID/slug validation present. |
| `app/api/google-ads/callback/route.ts` | GET handler, ≥85 lines | ✓ VERIFIED | 135 lines; imports `verifyState`/`safeTenantSlug`/`createClient`/`createServiceClient`; WR-01 session check (step 0), WR-02 try/catch around `.json()`, CR-01 `safeTenantSlug` guard in `settingsRedirect` all present. |
| `components/settings/google-ads-form.tsx` | Client component, ≥90 lines | ✓ VERIFIED | 165 lines; `'use client'`; top-level `window.location.href` navigation (no fetch to connect route); `useSearchParams`+`google_error` inline alert; `initialCustomerId` pre-fill wired into RHF `defaultValues`. |
| `app/[tenant-slug]/settings/page.tsx` | Contains `GoogleAdsForm`, static placeholder removed | ✓ VERIFIED | Imports and renders `GoogleAdsForm` with correct props; `account_id` added to select; `googleAccountId` derived and passed; old placeholder text absent; Meta Ads card (`<MetaAdsForm`) untouched. |
| `tests/unit/oauth-state.test.ts` | ≥45 lines, 6 cases | ✓ VERIFIED | 6/6 GREEN. |
| `tests/unit/google-ads-connect-route.test.ts` | ≥60 lines, 8 cases (Plan 01) | ✓ VERIFIED (9/9 GREEN — 1 case added post-review for WR-03) |
| `tests/unit/google-ads-callback-route.test.ts` | ≥90 lines, 7 cases (Plan 01) | ✓ VERIFIED (8/8 GREEN — 1 case added post-review for WR-01) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `connect/route.ts` | `lib/google-ads/oauth-state.ts` | `import { signState, safeTenantSlug }` | ✓ WIRED | Confirmed import + usage at lines 4, 95, 48, 79, 82. |
| `connect/route.ts` | `getClaims()` | tenant scope resolution for tenant_admin | ✓ WIRED | Line 84; query values ignored for tenant_admin (T-07-02), verified by dedicated test. |
| `callback/route.ts` | `lib/google-ads/oauth-state.ts` | `verifyState` | ✓ WIRED | Line 2, 32. |
| `callback/route.ts` | `create_or_update_vault_secret` RPC | `service.rpc` | ✓ WIRED | Line 110-113. |
| `callback/route.ts` | `ad_accounts` (google_ads row) | `service.from('ad_accounts').upsert` with `onConflict: 'tenant_id,channel'` | ✓ WIRED | Lines 118-127. |
| `google-ads-form.tsx` | `/api/google-ads/connect` | `window.location.href` top-level navigation | ✓ WIRED | Line 115; no `fetch(` call to the connect route present. |
| `settings/page.tsx` | `google-ads-form.tsx` | import + render inside Google Ads Card | ✓ WIRED | Confirmed import (line 12) and render (lines 178-182) with all required props. |
| `google-ads-form.tsx` | `?google_error=` query param | `useSearchParams` inline error display | ✓ WIRED | Reads `searchParams.get('google_error')`, maps through `ERROR_MESSAGES` covering all 10 connect+callback codes, renders `role="alert"` block. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 7 unit test files (3 files) all GREEN | `npx vitest run tests/unit/oauth-state.test.ts tests/unit/google-ads-connect-route.test.ts tests/unit/google-ads-callback-route.test.ts` | 3 files, 23 tests passed | ✓ PASS |
| Full test suite green, no regressions | `npm test` | 29 files, 231 passed / 1 skipped / 5 todo | ✓ PASS |
| Type-check clean (apart from pre-existing unrelated errors) | `npx tsc --noEmit` | Only the 2 pre-existing, documented `tests/integration/vault-rpc.test.ts` errors (lines 124, 135) | ✓ PASS |
| Production build succeeds; both routes present | `npm run build` | Succeeds; `/api/google-ads/connect` and `/api/google-ads/callback` both appear in route list | ✓ PASS |
| No secret/token logging | `grep -n "console.log"` across all 4 modified/created production files | No matches | ✓ PASS |
| Code-review fix commits landed in current code | Inspected `oauth-state.ts` (`safeTenantSlug`), `connect/route.ts` (`safeTenantSlug` + `z.uuid()` for super_admin), `callback/route.ts` (session check step 0 + try/catch around `.json()` + `safeTenantSlug` in `settingsRedirect`) | All 4 fixes (CR-01, WR-01, WR-02, WR-03) present in current working tree; commits `be3369e`, `d66f698`, `3a80a80`, `c79ec06` all present in `git log` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| SET-01 | 07-01, 07-02, 07-03, 07-04 (all 4 plans declare it) | Tenant Admin can connect a Google Ads account to their tenant via OAuth2 flow | ✓ SATISFIED (code-complete; live infra blocked per D-03) | All 3 roadmap success criteria verified in code (see Observable Truths #1-3); `REQUIREMENTS.md` line 46 already marks SET-01 `[x]` Complete; line 123 confirms Phase 7 mapping. No orphaned requirements found for Phase 7 — SET-01 is the only ID mapped and it is claimed by all 4 plans' frontmatter. |

No orphaned requirements: `REQUIREMENTS.md` maps only SET-01 to Phase 7, and all 4 plans declare `requirements: [SET-01]`.

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`PLACEHOLDER`/"coming soon"/"not implemented" strings in any of the 4 production files. No `console.log` in any route or component. No hardcoded empty-array/object stub returns. The static "será habilitada após a aprovação do Developer Token" placeholder that previously existed on the Settings page has been fully removed and replaced with the functional `GoogleAdsForm`.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GoogleAdsForm` | `initialCustomerId` (pre-fill) | `page.tsx` → `fetchTenantSettings()` → `supabase.from('ad_accounts').select('channel, active, account_id')` → `googleAccount?.account_id` | Yes — real Supabase query, not a static/empty return | ✓ FLOWING |
| `GoogleAdsForm` | `initialStatus` (badge) | `page.tsx` → `deriveStatus(accounts, 'google_ads')` (existing, pre-Phase-7 helper) | Yes — derived from the same real query | ✓ FLOWING |
| `callback/route.ts` | `tokens.refresh_token` | Live `fetch()` POST to `https://oauth2.googleapis.com/token` | Yes — real network call, mocked only in unit tests via `vi.stubGlobal('fetch', ...)` | ✓ FLOWING (mocked in tests, real in production code path) |

### Human Verification Required

### 1. Live end-to-end Google Ads OAuth2 round-trip

**Test:** Once a Google Cloud OAuth Client is created (D-03) and `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`/`GOOGLE_OAUTH_STATE_SECRET` are set in Vercel: visit `/[tenant-slug]/settings`, enter a real Google Ads Customer ID, click "Conectar Google Ads", complete Google's consent screen, confirm redirect back to Settings shows "Conectado" with the Customer ID pre-filled.

**Expected:** Browser navigates to Google's consent screen, returns to `/${tenantSlug}/settings?google_connected=1`, status badge shows "Conectado", Customer ID field is pre-filled.

**Why human:** Requires a real Google Cloud OAuth Client and live network round-trip against Google's OAuth servers — cannot be automated in CI without live credentials. This is a documented, intentional infra blocker (D-03 in `07-CONTEXT.md`), the same class as the Phase 2 Google Ads Developer Token, and is already tracked as a Manual-Only row in `07-VALIDATION.md`. It does not block marking this phase's code-level goal as achieved.

### Gaps Summary

No gaps. All 3 roadmap success criteria and all 5 PLAN-level must-have truths (merged across the 4 plans) are verified in the actual codebase — not just claimed in SUMMARY.md files. The one Critical (CR-01 open redirect) and 3 Warning findings from `07-REVIEW.md` were all independently confirmed fixed in the current working tree (not just claimed in `07-REVIEW-FIX.md`): `safeTenantSlug()` exists and is invoked in both routes, the callback route now has a session check as its first step, the token-exchange `.json()` call is wrapped in try/catch, and the `super_admin` tenant params are validated with `z.uuid()`/`safeTenantSlug()` instead of bare truthiness. The 4 fix commits (`be3369e`, `d66f698`, `3a80a80`, `c79ec06`) are all present in git history, and the corresponding test files include the new test cases the fix report claims were added (WR-01's "no authenticated session" test, WR-03's "malformed tenantId" test), which pass.

The only unmet item — a live browser round-trip against Google's real OAuth servers — is explicitly out of scope per this phase's documented D-03 infrastructure blocker and does not affect the `passed` status.

---

_Verified: 2026-07-11T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
