---
phase: 07-google-ads-oauth2-connect
plan: 01
subsystem: testing
tags: [vitest, oauth2, tdd, google-ads, hmac]

# Dependency graph
requires:
  - phase: 06-security-consistency-leads-endpoints
    provides: tests/unit/leads-status-route.test.ts mock scaffold (vi.mock('@/lib/supabase/server')/vi.mock('@/lib/supabase/service') pattern reused verbatim here)
provides:
  - "3 RED executable specs defining the exact contract for lib/google-ads/oauth-state.ts and app/api/google-ads/{connect,callback}/route.ts, to be turned GREEN by Plans 02/03"
affects: [07-02-PLAN, 07-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD RED convention (Phase 5 P01, Phase 6 P01) applied to a 2-route OAuth2 flow"
    - "Deliberate cross-test-file RED coupling: google-ads-callback-route.test.ts statically imports the real (not-yet-existing) signState from lib/google-ads/oauth-state.ts to build valid state fixtures for its own happy-path assertions"

key-files:
  created:
    - tests/unit/oauth-state.test.ts
    - tests/unit/google-ads-connect-route.test.ts
    - tests/unit/google-ads-callback-route.test.ts
  modified: []

key-decisions:
  - "google-ads-callback-route.test.ts imports signState statically (not per-test dynamic import) from @/lib/google-ads/oauth-state — causes the whole file to fail-to-load until Plan 02 exists, which is the plan's intended RED shape, not a defect"

patterns-established:
  - "OAuth state helper test pattern: fake timers (vi.useFakeTimers/vi.setSystemTime) to test HMAC payload expiry without real waits"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-11
---

# Phase 07 Plan 01: Google Ads OAuth2 Connect — Wave 0 RED Specs Summary

**3 RED Vitest specs (oauth-state HMAC helper, /connect route, /callback route) establishing the executable contract for Google Ads OAuth2 — zero production code, all failures are clean module-not-found, no syntax/collection errors.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-11T19:05:00Z (approx.)
- **Completed:** 2026-07-11T19:18:00Z
- **Tasks:** 3
- **Files modified:** 3 (all created)

## Accomplishments
- `tests/unit/oauth-state.test.ts` — 6 tests covering `signState`/`verifyState` round-trip (`expired:false`), tampered signature, tampered payload, malformed input, and the expired-but-validly-signed case (`{expired:true}`, payload preserved, NOT null — the D-04 recovery path)
- `tests/unit/google-ads-connect-route.test.ts` — 8 tests covering the 401-JSON no-user limitation, role/validation failures redirecting to `/${tenantSlug}/settings?google_error=...`, `tenant_admin` tenant scope resolved from `getClaims()` never the query string (T-07-02 Elevation-of-Privilege mitigation spec), and the successful 307 redirect to Google with `access_type=offline`+`prompt=consent`+signed `state`
- `tests/unit/google-ads-callback-route.test.ts` — 7 tests covering bad-signature state (→ `/` root, no Vault/upsert), expired-but-valid state (→ `/acme/settings?google_error=state_expired`), Google's own `?error=` param, the happy path (Vault write + `ad_accounts` upsert with `active:true`/`onConflict: tenant_id,channel`), token-exchange HTTP failure, missing `refresh_token` (Pitfall 2, T-07-05), and Vault write failure
- Confirmed via isolated per-file runs and a combined 3-file run that all 15 collected test cases (6+8+... ) fail cleanly on module-not-found/behavioral mismatch, never on syntax/collection errors
- Confirmed via full `npm test` that all 26 pre-existing test files still pass (208 passed, 1 skipped, 5 todo) — zero regressions introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests/unit/oauth-state.test.ts** - `153c5d8` (test)
2. **Task 2: Write tests/unit/google-ads-connect-route.test.ts** - `c6d928c` (test)
3. **Task 3: Write tests/unit/google-ads-callback-route.test.ts** - `26a4091` (test)

_No TDD GREEN/REFACTOR steps in this plan — Wave 0 is RED-only, mirroring Phase 5 Plan 01 and Phase 6 Plan 01's convention. Production code (`lib/google-ads/oauth-state.ts`, the two routes) is Plans 02/03's scope._

## Files Created/Modified
- `tests/unit/oauth-state.test.ts` - RED spec for the not-yet-existing `signState`/`verifyState` HMAC helper (Plan 02)
- `tests/unit/google-ads-connect-route.test.ts` - RED spec for the not-yet-existing `GET /api/google-ads/connect` route (Plan 02), mock scaffold copied from `tests/unit/leads-status-route.test.ts`
- `tests/unit/google-ads-callback-route.test.ts` - RED spec for the not-yet-existing `GET /api/google-ads/callback` route (Plan 03); statically imports the real `signState` from `@/lib/google-ads/oauth-state` to build valid state fixtures for its own happy-path tests — the file will not even collect until Plan 02 lands, by design

## Decisions Made
- Followed the plan's literal test case list verbatim for all 3 files — no case additions or removals
- Fixed one grep-brittleness issue found while self-verifying acceptance criteria: `vi.stubGlobal('fetch', ...)` was initially written across two lines, which failed the literal single-line grep pattern `vi.stubGlobal('fetch'` from the plan's acceptance criteria; collapsed to one line before committing (no behavioral change, purely a formatting fix caught during self-check)

## Deviations from Plan

None - plan executed exactly as written. (The `vi.stubGlobal` line-wrap fix above was corrected before the task's commit, not a post-hoc deviation — no separate commit was needed.)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. (Test-only plan; `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`/`GOOGLE_OAUTH_STATE_SECRET` env vars are set only within test `beforeEach` blocks as fixtures — real Vercel/`.env.local` provisioning is Plan 02's task 07-02-02.)

## Next Phase Readiness
- Plan 02 can now implement `lib/google-ads/oauth-state.ts` and `app/api/google-ads/connect/route.ts` against `tests/unit/oauth-state.test.ts` and `tests/unit/google-ads-connect-route.test.ts` as the executable spec, turning both GREEN
- Plan 03 can then implement `app/api/google-ads/callback/route.ts` against `tests/unit/google-ads-callback-route.test.ts` — note this file's own module resolution also depends on Plan 02's `oauth-state.ts` existing (intentional coupling), so Plan 02 must land first
- No blockers introduced by this plan

## Self-Check: PASSED

All 3 created test files verified present on disk; all 3 task commit hashes (153c5d8, c6d928c, 26a4091) verified present in git history.

---
*Phase: 07-google-ads-oauth2-connect*
*Completed: 2026-07-11*
