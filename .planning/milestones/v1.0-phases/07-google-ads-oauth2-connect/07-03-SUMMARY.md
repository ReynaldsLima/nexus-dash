---
phase: 07-google-ads-oauth2-connect
plan: 03
subsystem: google-ads-oauth2
tags: [oauth2, route-handler, google-ads, vault, ad-accounts]

# Dependency graph
requires:
  - phase: 07-google-ads-oauth2-connect
    provides: "Plan 01's RED spec (tests/unit/google-ads-callback-route.test.ts) as the executable contract this plan turns GREEN; Plan 02's lib/google-ads/oauth-state.ts verifyState() helper"
provides:
  - "GET /api/google-ads/callback — token-exchange Route Handler completing the OAuth2 web-server flow: verify state, exchange code, Vault write, ad_accounts upsert, redirect"
affects: [07-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated verifyState() consumption: null (bad signature) -> redirect to '/', {payload, expired:true} (validly-signed-but-stale) -> redirect to /${tenantSlug}/settings?google_error=state_expired using the recovered tenantSlug"
    - "Raw fetch token exchange against Google's OAuth2 token endpoint (application/x-www-form-urlencoded), same style as the Meta Ads Graph API calls, no OAuth client library"
    - "Missing refresh_token treated as a hard error (google_error=no_refresh_token) rather than a silent partial connect"

key-files:
  created:
    - app/api/google-ads/callback/route.ts
  modified: []

key-decisions:
  - "settingsRedirect() helper builds every non-root exit URL from the state's recovered tenantSlug — success sets google_connected=1, failures set google_error=<code>, keeping every exit path consistent and testable"
  - "Only vault_secret_id is ever persisted to ad_accounts; refresh_token/access_token/code are never written to a column or logged (console.error logs only .message, mirroring the Meta connect route's Pitfall 5 convention)"

requirements-completed: [SET-01]

# Metrics
duration: ~8min
completed: 2026-07-11
---

# Phase 07 Plan 03: Google Ads OAuth2 Connect — Callback Route (Token Exchange) Summary

**`GET /api/google-ads/callback` completes the OAuth2 web-server flow: verifies the signed state (bad-signature to root, expired-but-valid to Settings with an inline error), exchanges the code against Google's token endpoint via raw fetch, stores the refresh_token in Supabase Vault, and upserts an active `google_ads` row in `ad_accounts`.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-11
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- `app/api/google-ads/callback/route.ts` — `GET` handler that verifies `state` FIRST via Plan 02's `verifyState()` (the CSRF/replay defense, T-07-01): a bad/tampered signature redirects to `/` with zero side effects; a validly-signed-but-expired state (>10min on Google's consent screen, the common case) redirects to `/${tenantSlug}/settings?google_error=state_expired` using the recovered, still-trustworthy `tenantSlug` (D-04). Google's own `?error=` param (e.g. `access_denied`) also redirects inline. The authorization code is exchanged via raw `fetch` against `https://oauth2.googleapis.com/token` (same style as the Meta connect route — no OAuth client library), with `redirect_uri` derived from `req.nextUrl.origin` as a single source of truth (Pitfall 1). A token response missing `refresh_token` is a hard error (`google_error=no_refresh_token`, T-07-05) — never a silent partial connect. On success, the `refresh_token` is written to Supabase Vault via `create_or_update_vault_secret` (secret name `google_ads_token_${tenantId}`) and a `google_ads` row is upserted into `ad_accounts` with `active:true` and `onConflict: 'tenant_id,channel'` (D-02: no live Google Ads API validation; D-05: reconnect overwrites). Neither the refresh_token/access_token/code nor any Vault error detail is ever logged — `console.error` logs only `.message`.
- `tests/unit/google-ads-callback-route.test.ts` fully GREEN (7/7): bad-signature state, expired-but-valid state, Google error param, happy path (Vault write + upsert assertions), token-exchange HTTP failure, missing refresh_token, and Vault write failure.
- Full suite: 29/29 test files, 229 passed / 1 skipped / 5 todo — zero regressions. The previously-documented `anomaly_alerts` realtime websocket cold-start flake (noted since Phase 4 Plan 02) did NOT reproduce on this run.
- `npx tsc --noEmit` clean apart from the 2 pre-existing unrelated `tests/integration/vault-rpc.test.ts` errors (lines 124, 135 — unrelated to this plan).
- `npm run build` succeeds; `/api/google-ads/callback` appears in the Next.js route list alongside `/api/google-ads/connect`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app/api/google-ads/callback/route.ts** - `b0f89fb` (feat)

## Files Created/Modified

- `app/api/google-ads/callback/route.ts` - `GET` handler: verify state (bad-sig->/, expired->state_expired) -> exchange code -> Vault write -> ad_accounts upsert -> redirect (108 lines)

## Decisions Made

- Followed the plan's literal reference implementation verbatim — no structural deviation from the provided code blocks.
- `settingsRedirect(errCode?)` helper centralizes every exit URL construction from the recovered `tenantSlug`, keeping success (`google_connected=1`) and every failure path (`google_error=<code>`) consistent.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit`/`npm run build`/`npx vitest run` all clean on the first pass; no auto-fixes required.

## User Setup Required

**Deferred infrastructure blocker (D-03), same class as the Phase 2 Developer Token and Plan 02's setup note — code is complete and unit-verified with mocks; the live round-trip is deferred until the OAuth Client exists:**

1. `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` must be set in Vercel (Production + Preview + Development) — see Plan 02's User Setup Required section for the full Google Cloud OAuth Client creation + redirect URI registration steps.

None of this blocks code review, the automated test suite, or the build. It only blocks a live end-to-end manual verification of the full OAuth round-trip, tracked in `07-VALIDATION.md`'s Manual-Only row — same precedent as Phase 2's Developer Token.

## Next Phase Readiness

- Plan 04 (UI wiring + live checkpoint) can now wire the Settings page "Connect Google Ads" entry point to `GET /api/google-ads/connect`, and both routes are complete end-to-end (mocked/unit-verified).
- Plan 04's live checkpoint still depends on the user completing the Google Cloud OAuth Client setup documented in Plan 02's User Setup Required section.
- SET-01 requirement code is now complete: both `/api/google-ads/connect` (Plan 02) and `/api/google-ads/callback` (this plan) exist and are fully unit-tested.
- No blockers introduced by this plan.

## Self-Check: PASSED

`app/api/google-ads/callback/route.ts` verified present on disk; commit hash `b0f89fb` verified present in git history via `git log --oneline -5`.

---
*Phase: 07-google-ads-oauth2-connect*
*Completed: 2026-07-11*
