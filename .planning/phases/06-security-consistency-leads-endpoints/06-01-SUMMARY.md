---
phase: 06-security-consistency-leads-endpoints
plan: 01
subsystem: testing
tags: [vitest, security, auth, api, rate-limit, tdd]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    provides: getClaims()-based role/tenant_slug/agency_id scope pattern and agency_tenants grant lookup, mirrored here from tests/unit/leads-status-route.test.ts
provides:
  - "tests/unit/rate-limit.test.ts — RED spec for lib/rate-limit.ts's checkRateLimit(key, opts)"
  - "tests/unit/leads-get-route.test.ts — RED spec for GET /api/leads auth/role/scope gate (AGENCY-08)"
  - "tests/unit/leads-chat-route.test.ts — RED spec for POST /api/leads/chat hardening + AI SDK migration"
affects: [06-02-PLAN (GET /api/leads hardening), 06-03-PLAN (lib/rate-limit.ts + chat route hardening/SDK migration)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD RED scaffolding: test files written against not-yet-existing production code/modules, committed as the executable spec Wave 1 must turn green"
    - "vi.useFakeTimers()/vi.setSystemTime() to test a sliding-window rate limiter without real waits"

key-files:
  created:
    - tests/unit/rate-limit.test.ts
    - tests/unit/leads-get-route.test.ts
    - tests/unit/leads-chat-route.test.ts
  modified: []

key-decisions:
  - "All three test files reuse the mock structure from tests/unit/leads-status-route.test.ts (role/scope) and tests/unit/insights-generate-route.test.ts (ai SDK streamText mock) verbatim, per plan interfaces block — no new mock conventions introduced"

patterns-established:
  - "checkRateLimit(key, { max, windowMs }) => { allowed, retryAfterSeconds } — sliding window keyed by caller's user.id, verified via fake timers"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-07-11
---

# Phase 6 Plan 01: Wave 0 TDD RED Scaffolding for Security-Hardening Tests Summary

**Three new Vitest spec files (rate-limit, GET /api/leads, POST /api/leads/chat) that fail exactly as intended — an import-not-found and 17 behavioral 4xx-status mismatches — encoding the AGENCY-08 auth/role/scope gate and the shared-Anthropic-key rate limiter Wave 1 must implement.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-11T12:49Z (approx, first test-file write)
- **Completed:** 2026-07-11T12:52Z
- **Tasks:** 3
- **Files modified:** 3 (all new)

## Accomplishments
- `tests/unit/rate-limit.test.ts`: 4 tests (`checkRateLimit`) covering allow-up-to-max, reject max+1 with `retryAfterSeconds > 0`, reset-after-window (via `vi.useFakeTimers`/`vi.setSystemTime`, no real 5-minute waits), and per-key isolation. Fails with a clean "module not found" for `@/lib/rate-limit` — no such file exists yet (Plan 03 creates it).
- `tests/unit/leads-get-route.test.ts`: 10 tests for `GET /api/leads`, asserting the full AGENCY-08 check order (400 missing param → 401 no user → 403 role/scope → 200 allowed) against the current unhardened route. 6 of 10 fail today (viewer, rpc-error, tenant_admin-mismatch, agency-no-grant, agency-no-agency-id all currently return 200/other instead of 403) — proving the gate genuinely doesn't exist yet.
- `tests/unit/leads-chat-route.test.ts`: 10 tests for `POST /api/leads/chat`, combining the role/scope mock with an `ai` SDK `streamText` mock (`vi.fn`) to prove the raw-`fetch` proxy is replaced, plus a 21-call rate-limit test asserting a 429 with a `Retry-After` header on the 21st call. 8 of 10 fail today (no role gate, no 400 on missing `tenant`, no rate limiting) against the current unhardened proxy route.
- Confirmed via `npx vitest run` (isolated) and `npm test` (full suite) that all RED failures are behavioral/import-level — zero syntax or collection errors — and the rest of the 26-file suite (23 other files) passes clean, matching the plan's verification requirement.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/unit/rate-limit.test.ts** - `45d43ee` (test)
2. **Task 2: Create tests/unit/leads-get-route.test.ts** - `2f3a414` (test)
3. **Task 3: Create tests/unit/leads-chat-route.test.ts** - `b721889` (test)

**Plan metadata:** (this commit, following STATE/ROADMAP update)

## Files Created/Modified
- `tests/unit/rate-limit.test.ts` - Pure-function RED spec for `checkRateLimit()` sliding-window limiter (Plan 03 target)
- `tests/unit/leads-get-route.test.ts` - Route RED spec for `GET /api/leads` auth/role/scope gate (Plan 02 target)
- `tests/unit/leads-chat-route.test.ts` - Route RED spec for `POST /api/leads/chat` hardening + Vercel AI SDK migration (Plan 03 target)

## Decisions Made
None — plan's literal test code executed verbatim, mock structures copied from the two named reference files exactly as instructed.

## Deviations from Plan

None - plan executed exactly as written. All three files use the exact content blocks given in the plan's `<action>` sections, unmodified.

## Issues Encountered
None. Isolated run (`npx vitest run tests/unit/rate-limit.test.ts tests/unit/leads-get-route.test.ts tests/unit/leads-chat-route.test.ts`) showed 18 failed / 6 passed of 24 total tests — all failures either the expected `@/lib/rate-limit` module-not-found or a 4xx-status mismatch against the current unhardened routes, confirmed not syntax errors. Full-suite `npm test` afterward: 3 failed / 23 passed test files, 19 failed / 189 passed / 1 skipped / 5 todo of 214 total tests, with no new collection errors and no regressions in the other 23 files (a prior session's documented `anomaly_alerts` realtime websocket cold-start flake did not reproduce on this run).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (GET /api/leads hardening) can proceed directly against `tests/unit/leads-get-route.test.ts` as its green target.
- Plan 03 (`lib/rate-limit.ts` + POST /api/leads/chat hardening/SDK migration) can proceed directly against `tests/unit/rate-limit.test.ts` and `tests/unit/leads-chat-route.test.ts` as its green targets.
- No blockers. All three RED files are complete, runnable specs (no `it.todo()` placeholders) as required by this plan's success criteria.

---
*Phase: 06-security-consistency-leads-endpoints*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 3 created files found on disk; all 3 task commits (`45d43ee`, `2f3a414`, `b721889`) found in git log.
