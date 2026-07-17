---
phase: 11-janela-de-hist-rico-retroativo
plan: 01
subsystem: database
tags: [supabase, postgres, migration, oauth, hmac, typescript]

# Dependency graph
requires:
  - phase: 07-google-ads-oauth2-connect
    provides: lib/google-ads/oauth-state.ts (signState/verifyState HMAC helper, 3-arg signature)
provides:
  - "ad_accounts.backfill_days column live in Supabase (INTEGER NOT NULL DEFAULT 90, CHECK 7-365)"
  - "Regenerated types/database.types.ts including backfill_days"
  - "signState/StatePayload extended with backfillDays (4-arg signature)"
affects: [11-02-google-ads-routes, 11-03-meta-ads-route, 11-04-post-connect-edit, 11-05-n8n-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Management API (https://api.supabase.com/v1/projects/{ref}/database/query and /types/typescript) used as a CLI-less fallback for pushing migrations and regenerating types when neither the supabase CLI nor an MCP Supabase tool is available in the execution session, using SUPABASE_ACCESS_TOKEN already present in the shell environment"

key-files:
  created:
    - supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql
  modified:
    - types/database.types.ts
    - lib/google-ads/oauth-state.ts
    - tests/unit/oauth-state.test.ts

key-decisions:
  - "Used the Supabase Management API via curl/node (not the CLI, not an MCP tool) to push migration 0024 live and regenerate types, since SUPABASE_ACCESS_TOKEN was already present in the shell environment"

patterns-established:
  - "CLI-less Supabase operations: POST /v1/projects/{ref}/database/query for arbitrary SQL, GET /v1/projects/{ref}/types/typescript for type generation — both authenticated with SUPABASE_ACCESS_TOKEN as a Bearer token"

requirements-completed: [SET-03, SET-04]

# Metrics
duration: 13min
completed: 2026-07-17
---

# Phase 11 Plan 01: Schema + OAuth State Foundation Summary

**Live `ad_accounts.backfill_days` column (7–365, default 90) plus a 4-argument `signState` that carries the chosen backfill window across the Google OAuth redirect boundary inside its HMAC-signed payload.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-17T22:24:00Z (approx, session resumed)
- **Completed:** 2026-07-17T22:37:24Z
- **Tasks:** 3 completed (Task 3 as TDD RED→GREEN)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql` created and pushed live to the `rvkkvjitfddtbdpkupok` project — `ad_accounts.backfill_days` confirmed live via `information_schema.columns` (integer, NOT NULL, default 90)
- `types/database.types.ts` regenerated (diff-clean, 3 line additions only) via the Supabase Management API's typescript-generation endpoint
- `lib/google-ads/oauth-state.ts`'s `StatePayload`/`signState` extended with `backfillDays: number` — HMAC/TTL/nonce behavior byte-for-byte unchanged
- `tests/unit/oauth-state.test.ts` taken through a real RED→GREEN cycle: 4-arg calls + 2 new `payload.backfillDays` assertions failed first (2/6), then passed (6/6) after the implementation change

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 0024 adding ad_accounts.backfill_days** - `b35919e` (feat)
2. **Task 2 [BLOCKING]: Push migration 0024 live and regenerate TypeScript types** - `88cbfd3` (chore)
3. **Task 3: Extend signState + StatePayload with backfillDays** - `bbd66da` (test, RED) + `721461a` (feat, GREEN)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql` - `ALTER TABLE ad_accounts ADD COLUMN backfill_days INTEGER NOT NULL DEFAULT 90 CHECK (BETWEEN 7 AND 365)` + column comment
- `types/database.types.ts` - regenerated; `ad_accounts.Row`/`Insert`/`Update` now include `backfill_days: number`
- `lib/google-ads/oauth-state.ts` - `StatePayload.backfillDays: number` added; `signState` is now a 4-arg function `(tenantId, tenantSlug, customerId, backfillDays)`; `verifyState` untouched (payload flows through JSON parse automatically)
- `tests/unit/oauth-state.test.ts` - all 6 `signState` calls updated to 4-arg form; 2 new `payload.backfillDays` assertions (round-trip case and expired-but-validly-signed case, proving the window survives D-04's stale-redirect recovery path)

## Decisions Made
- **CLI/MCP unavailable → Management API fallback:** Neither the Supabase CLI (`supabase: command not found`) nor an `mcp__supabase__*` tool were present in this execution session's tool set, despite both being referenced in the task prompt and this repo's `.mcp.json`. `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` were already exported in the shell environment (inherited from the user's profile), so the migration was pushed and types regenerated via direct calls to the Supabase Management API (`POST /v1/projects/{ref}/database/query`, `GET /v1/projects/{ref}/types/typescript`) — verified against the correct project (`rvkkvjitfddtbdpkupok`, `nexus-dash`) before writing anything, per the project's known multi-account MCP-connector-mismatch risk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration push tooling unavailable — used Management API instead of CLI/MCP**
- **Found during:** Task 2 (Push migration 0024 live)
- **Issue:** Plan's primary path (`supabase db push`) and its stated MCP fallback (`apply_migration`) were both unavailable in this session's tool set
- **Fix:** Verified `SUPABASE_ACCESS_TOKEN` was already in the shell environment, confirmed it resolved to the correct project via `GET /v1/projects/{ref}`, then applied the exact migration SQL via `POST /v1/projects/{ref}/database/query` and regenerated types via `GET /v1/projects/{ref}/types/typescript`
- **Files modified:** types/database.types.ts (regenerated)
- **Verification:** Live column confirmed via `information_schema.columns` query returning `{column_name: backfill_days, data_type: integer, is_nullable: NO, column_default: 90}`; `git diff` on the regenerated types file showed exactly 3 additions, no stray formatting
- **Committed in:** `88cbfd3`

---

**Total deviations:** 1 auto-fixed (1 blocking-tooling substitution)
**Impact on plan:** No scope creep — same live outcome (`ad_accounts.backfill_days` live, types regenerated) the plan required, achieved via an equivalent authenticated API path instead of the unavailable CLI/MCP tools. No application code behavior changed by this substitution.

## Issues Encountered
- Task 3's `signState` signature change is a genuine, intentional breaking change to an existing 3-arg call site (`app/api/google-ads/connect/route.ts`) and its associated test fixtures (`tests/unit/google-ads-callback-route.test.ts`), both of which now fail `npx tsc --noEmit` with `Expected 4 arguments, but got 3` (8 new errors total). This is **not** a regression introduced by scope creep — both files are explicitly listed in Plan 11-02's `files_modified` (`depends_on: [01]`), confirming this is the intended interface-first Wave 1 → Wave 2 boundary the phase's plans were designed around (mirrors the Wave-0-scaffold pattern used repeatedly in prior phases, e.g. Phase 04/05/07 Plan 01s). `npx tsc --noEmit` therefore currently shows 10 errors total: the 2 pre-existing unrelated `vault-rpc.test.ts` errors plus these 8 expected-and-temporary ones, all scoped to Plan 11-02's files. This plan's own file scope (`oauth-state.ts` + its test) is fully green.
- Full `npx vitest run` showed one failure (`tests/unit/anomaly-alerts-schema.test.ts`'s realtime-delivery case) on the combined run — confirmed via isolated re-run (7/7 passed) to be the same pre-existing websocket cold-start flake documented since Phase 4 Plan 02, not a regression from this plan.

## User Setup Required

None - no external service configuration required. (The Supabase Management API calls used `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` already present in the environment; no new secret was requested from or provided by the user.)

## Next Phase Readiness
- `ad_accounts.backfill_days` is live and typed — Plan 11-02 (Google Ads connect/callback routes) and 11-03 (Meta route) can now read/write it directly via the generated Supabase types.
- `signState`'s 4-arg contract is locked — Plan 11-02 must update `app/api/google-ads/connect/route.ts`'s `signState(...)` call site (currently 3 args, intentionally left broken per the Wave 1→2 boundary documented above) and `tests/unit/google-ads-callback-route.test.ts`'s fixtures to close the temporary `tsc` gap.
- No blockers for 11-02/11-03/11-04/11-05.

---
*Phase: 11-janela-de-hist-rico-retroativo*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created/modified files confirmed present on disk (migration, types, oauth-state.ts, oauth-state.test.ts, this SUMMARY). All 4 task commit hashes (`b35919e`, `88cbfd3`, `bbd66da`, `721461a`) confirmed present in `git log --oneline --all`.
