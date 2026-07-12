---
phase: 04-ai-insights
plan: 03
subsystem: api
tags: [vercel-ai-sdk, anthropic, streaming, zod, vitest, nextjs-route-handler]

# Dependency graph
requires:
  - phase: 04-ai-insights (Plan 02)
    provides: "ai_insights table live with super_admin-only RLS; ai + @ai-sdk/anthropic installed"
provides:
  - "lib/ai/parse-insight-block.ts — extractStructuredBlock/stripStructuredBlock, shared by both the on-demand and daily routes"
  - "lib/ai/anthropic.ts — insightModel + MODEL_ID singleton (claude-sonnet-4-6)"
  - "lib/ai/insight-prompt.ts — buildOnDemandPrompt/buildDailyPrompt/resolveTenantId, aggregates last-30d daily_rollups + campaign_metrics into one XML-wrapped payload per tenant"
  - "POST /api/insights/generate — super_admin-only streaming Route Handler (AI-01), auto-persists to ai_insights on completion with parse-failure fallback"
  - "vercel.json maxDuration=60 functions block for both insight routes"
affects: ["04-ai-insights Plan 04 (insights UI button consumes this route)", "04-ai-insights Plan 06 (daily route reuses buildDailyPrompt/parse-insight-block verbatim)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared lib/ai/ core: one Zod-validated parser + one prompt-builder module consumed by both the on-demand (this plan) and daily (Plan 06) routes — Interface-First, Plan 06 only reads lib/ai/"
    - "Streaming Route Handler auto-persist on completion: streamText's onFinish callback parses accumulated text and inserts exactly one ai_insights row — no explicit Save action (D-03)"
    - "Parse-failure fallback: on a null extractStructuredBlock result, insert a defaulted row (type=optimization, impact=medium, summary=streamed prose) rather than dropping the insight — decided in 04-CONTEXT.md, applied literally"
    - "XML-tagged data injection: aggregated campaign JSON wrapped in <campaign_data>...</campaign_data>, system prompt instructs the model to treat it as data, never instructions (prompt-injection mitigation, T-04-05)"

key-files:
  created:
    - lib/ai/anthropic.ts
    - lib/ai/parse-insight-block.ts
    - lib/ai/insight-prompt.ts
    - app/api/insights/generate/route.ts
  modified:
    - vercel.json
    - tests/unit/parse-insight-block.test.ts
    - tests/unit/insights-generate-route.test.ts

key-decisions:
  - "Followed the plan's provided code verbatim for lib/ai/anthropic.ts, lib/ai/parse-insight-block.ts, and app/api/insights/generate/route.ts — no deviation"
  - "insight-prompt.ts's aggregateTenantData derives ROAS/CPA/CTR per channel AND per campaign from the two source tables (daily_rollups, campaign_metrics), matching the plan's exact column list; one query pair per tenant, never per-campaign calls (D-09/Pitfall 4)"
  - "vercel.json's functions block references app/api/insights/daily/route.ts even though that file doesn't exist yet — intentional, per the plan's literal instruction; Plan 06 creates it. Vercel config isn't validated by `next build` locally, only at actual Vercel deploy time"

patterns-established:
  - "Pattern: fallback-on-parse-failure for AI-generated structured output — never let a malformed model response silently drop a user-facing insight; always insert a safe, defaulted row instead (T-04-06 mitigation)"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-11
---

# Phase 04 Plan 03: On-Demand AI Insights Streaming Route Summary

**`lib/ai/` core (Zod-validated `<insight_data>` parser + 30-day tenant-data aggregator/prompt builders) plus `POST /api/insights/generate`, a super_admin-only Route Handler that streams Claude's pt-BR analysis token-by-token and auto-persists exactly one `ai_insights` row on completion, with a safe fallback row on parse failure.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-11T01:29:00Z (approx.)
- **Completed:** 2026-07-11T01:38:33Z
- **Tasks:** 3/3 completed
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- `lib/ai/anthropic.ts` exports `MODEL_ID` (`claude-sonnet-4-6`) and `insightModel` — single provider reference for both this route and Plan 06's daily route
- `lib/ai/parse-insight-block.ts` exports `extractStructuredBlock` (Zod-validated, never throws — returns `null` on absent/malformed/schema-failing input), `stripStructuredBlock`, and `InsightBlockSchema`
- `lib/ai/insight-prompt.ts` exports `buildOnDemandPrompt`, `buildDailyPrompt`, and `resolveTenantId`, sharing a private `aggregateTenantData` helper that reads both `daily_rollups` (channel-level) and `campaign_metrics` (campaign-level) for the last 30 days and derives ROAS/CPA/CTR, wrapped in a single `<campaign_data>` JSON payload per tenant
- `POST /api/insights/generate` streams the analysis via `streamText` (D-01/D-12), gated `getUser()` → 401 / `get_user_role()` RPC → 403 unless `super_admin` (mirrors `app/api/meta-ads/connect/route.ts` exactly), and auto-persists to `ai_insights` in `onFinish` with `source='on_demand'` — no explicit Save action (D-03)
- Parse-failure fallback implemented and verified: `type ?? 'optimization'`, `impact ?? 'medium'`, `summary = prose || text` — an insight is never silently dropped (T-04-06)
- `vercel.json` gained a `functions` block setting `maxDuration: 60` for both `app/api/insights/generate/route.ts` (this plan) and `app/api/insights/daily/route.ts` (Plan 06), preserving the existing `regions: ["gru1"]`
- Both Wave 0 unit test scaffolds converted from `it.todo()` to real, passing assertions: `parse-insight-block.test.ts` (9/9 — includes the extra `stripStructuredBlock` cases) and `insights-generate-route.test.ts` (8/8 — 401/403×4/400 plus a 200 happy-path streaming-mock check)
- Full suite, `npx tsc --noEmit`, and `npm run build` all clean (only the 2 pre-existing unrelated `vault-rpc.test.ts` errors remain, documented since Plan 02)

## Task Commits

1. **Task 1 RED: failing tests for extractStructuredBlock/stripStructuredBlock** - `fb2fa18` (test)
2. **Task 1 GREEN: lib/ai/parse-insight-block.ts + lib/ai/anthropic.ts** - `45bcd11` (feat)
3. **Task 2: lib/ai/insight-prompt.ts (buildOnDemandPrompt/buildDailyPrompt/resolveTenantId)** - `260fc46` (feat)
4. **Task 3: app/api/insights/generate/route.ts + vercel.json + filled route tests** - `2cbf115` (feat)

**Plan metadata:** (this commit, pending)

_Note: Task 1 used the TDD RED→GREEN flow per its `tdd="true"` flag; Tasks 2-3 were standard `auto` tasks._

## Files Created/Modified
- `lib/ai/anthropic.ts` - `MODEL_ID` constant + `insightModel` provider singleton
- `lib/ai/parse-insight-block.ts` - `InsightBlockSchema` (Zod), `extractStructuredBlock`, `stripStructuredBlock`
- `lib/ai/insight-prompt.ts` - `aggregateTenantData` (private), `buildOnDemandPrompt`, `buildDailyPrompt`, `resolveTenantId`
- `app/api/insights/generate/route.ts` - super_admin-only streaming Route Handler, `runtime='nodejs'`, `maxDuration=60`
- `vercel.json` - added `functions` block (`maxDuration: 60` for both insight routes), kept `regions`
- `tests/unit/parse-insight-block.test.ts` - 9 real assertions (was 6 `it.todo()` + sanity check)
- `tests/unit/insights-generate-route.test.ts` - 8 real assertions (was 6 `it.todo()` + sanity check)

## Decisions Made
- Executed the plan's provided code for `lib/ai/anthropic.ts`, `lib/ai/parse-insight-block.ts`, and `app/api/insights/generate/route.ts` verbatim — no deviation.
- `insight-prompt.ts` was written from the plan's prose spec (no verbatim code block given) — implemented `aggregateTenantData` to sum `daily_rollups`/`campaign_metrics` over the last 30 days and derive ROAS (`convValue/spend`), CPA (`spend/conversions`), CTR (`clicks/impressions × 100`) per channel and per campaign, matching the plan's exact column list and both required `grep` targets (`from('daily_rollups')`, `from('campaign_metrics')`).
- `resolveTenantId` fails closed (`null`) on any query error or missing tenant, causing the route to return `404 Tenant not found` rather than proceeding with an unresolved id.

## Deviations from Plan

None - plan executed exactly as written. `insight-prompt.ts`'s implementation follows the plan's prose description (aggregation logic, XML-tagged prompt structure, pt-BR system prompt, `resolveTenantId` helper) since that task provided requirements rather than a literal code block, but every acceptance-criteria grep target and behavior matches.

## Issues Encountered
None specific to this plan. Re-ran the full suite after Task 3 and observed the pre-existing flaky `anomaly_alerts` realtime test (documented in Plan 02's SUMMARY — a one-time websocket cold-start on the first Realtime subscription of a combined multi-file run) fail once; re-ran `tests/unit/anomaly-alerts-schema.test.ts` in isolation immediately after and it passed 7/7, confirming this is the same pre-existing flake, not a regression introduced by this plan.

## User Setup Required

None for local development — `ANTHROPIC_API_KEY` is already present in `.env.local`. Still outstanding for deployment (carried over from Plan 02, unchanged): add `ANTHROPIC_API_KEY` to the Vercel Dashboard (Production + Preview + Development) before this streaming route is deployed. Not a blocker for continuing local execution of Plans 04-06.

## Next Phase Readiness
- `lib/ai/` core is complete and stable — Plan 06's daily route can import `buildDailyPrompt`, `extractStructuredBlock`, `stripStructuredBlock`, and `insightModel` without any further changes to this plan's files.
- `POST /api/insights/generate` is live and testable locally (manual verification — triggering a real Claude call and confirming token-by-token streaming plus a new `ai_insights` row — is out of this plan's automated scope per `04-VALIDATION.md`, deferred to UAT alongside Plan 04's UI button).
- AI-01 requirement is intentionally NOT marked complete in `.planning/REQUIREMENTS.md` — its literal wording ("Super Admin can trigger on-demand campaign analysis via a button on the dashboard") requires the UI button that Plan 04 (`requirements: [AI-01, AI-03]`) delivers. This plan satisfies the backend half only; the checkbox should flip when Plan 04 lands the observable UI behavior. Same judgment-call precedent as Plan 02's AI-03/AI-04 handling.
- No blockers identified for Plan 04.

---
*Phase: 04-ai-insights*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: lib/ai/anthropic.ts
- FOUND: lib/ai/parse-insight-block.ts
- FOUND: lib/ai/insight-prompt.ts
- FOUND: app/api/insights/generate/route.ts
- FOUND: vercel.json
- FOUND: tests/unit/parse-insight-block.test.ts
- FOUND: tests/unit/insights-generate-route.test.ts
- FOUND: .planning/phases/04-ai-insights/04-03-SUMMARY.md
- FOUND commit: fb2fa18 (Task 1 RED)
- FOUND commit: 45bcd11 (Task 1 GREEN)
- FOUND commit: 260fc46 (Task 2)
- FOUND commit: 2cbf115 (Task 3)
