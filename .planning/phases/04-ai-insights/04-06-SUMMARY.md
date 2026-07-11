---
phase: 04-ai-insights
plan: 06
subsystem: api
tags: [n8n, cron, vercel-ai-sdk, anthropic, postgrest, vitest]

# Dependency graph
requires:
  - phase: 04-ai-insights (Plan 03)
    provides: "lib/ai/ shared core: insightModel, buildDailyPrompt, extractStructuredBlock/stripStructuredBlock"
  - phase: 04-ai-insights (Plan 05)
    provides: "anomaly_alerts table live with RLS + Realtime publication membership; in-app toast/badge that reacts to new rows"
provides:
  - "POST /api/insights/daily — N8N-triggered, shared-secret-gated daily analysis route (AI-02)"
  - "n8n-workflows/daily-insights-and-anomaly-detection.json — single N8N workflow (D-08): insights branch (calls the route) + ROAS anomaly-detection branch (pure N8N -> PostgREST), scheduled 05:00 UTC, inactive pending import"
  - "AI-02 unit test filled (4 real assertions, was it.todo())"
affects: ["Phase 4 closes out — this was the last pending plan (04-06/6); future phases should treat AI-02/AI-04 as fully wired end-to-end pending live N8N import + manual UAT"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-secret Route Handler auth for server-to-server (N8N -> Vercel) calls: no Supabase session, single header compared against a server-only env var, mirrors 04-RESEARCH.md Architecture Pattern 2"
    - "N8N ROAS-anomaly detection lives entirely inside the workflow (Code node), not in the route or a Postgres function — keeps ANTHROPIC_API_KEY exclusively on Vercel, and keeps the anomaly math independently editable by ops without a code deploy"

key-files:
  created:
    - app/api/insights/daily/route.ts
    - n8n-workflows/daily-insights-and-anomaly-detection.json
  modified:
    - tests/unit/insights-daily-route.test.ts

key-decisions:
  - "Anomaly-detection-location decision (locked D-05): ROAS-drop detection is implemented as an N8N Code node (Get recent campaign_metrics -> Compute ROAS anomalies -> Insert anomaly_alerts), NOT a Postgres function and NOT the /api/insights/daily route. This is why the optional tests/unit/roas-anomaly-detection.test.ts mentioned in 04-RESEARCH.md's file map was deliberately NOT created — N8N Function-node JS logic embedded in a workflow JSON is not meaningfully Vitest-testable outside a running N8N instance. The route's only responsibility is the daily insight text generation; anomaly math is fully owned by the workflow."
  - "Current-vs-prior ROAS window derived from campaign_metrics' per-day granularity (one row per campaign per date), not literal 24h timestamp math: the Code node sorts each campaign's rows by date desc and compares the two most recent distinct date rows (current vs prior 24h window), matching the table's actual grain rather than inventing a timestamp column that doesn't exist."
  - "VERCEL_APP_URL left as a clearly-flagged placeholder (https://nexus-dash.vercel.app) with an explicit node note instructing the user to replace it with the real production URL post-import — same deferred-activation convention as the existing sync workflows (active: false)."

patterns-established:
  - "Pattern: server-to-server routes (no user session) gate on a single shared-secret header compared against a server-only env var — reusable for any future N8N-triggered Route Handler"

requirements-completed: [AI-02, AI-04]

# Metrics
duration: 18min
completed: 2026-07-11
---

# Phase 04 Plan 06: Daily AI Insights + ROAS Anomaly Detection Summary

**N8N-triggered `POST /api/insights/daily` (shared-secret auth, D-07 eligibility check, non-streaming `generateText`, auto-persists `source='daily'`) plus a single N8N workflow scheduled 05:00 UTC that both drives that route per eligible tenant and independently detects >20% ROAS drops, inserting `anomaly_alerts` rows via PostgREST — closing out Phase 4 (AI Insights).**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `app/api/insights/daily/route.ts` — gated by `x-n8n-secret` vs `process.env.N8N_INSIGHTS_SECRET` (401 on missing/wrong secret), validates the payload `tenantId` actually has `>= 1 ad_accounts` row before doing any work (D-07; ineligible tenants get a `200 { skipped: true }`, never an error), calls `generateText` (non-streaming — no human is watching a daily cron job) via the shared `lib/ai/` core from Plan 03, and auto-persists exactly one `ai_insights` row with `source: 'daily'`
- `tests/unit/insights-daily-route.test.ts` — all 4 `it.todo()` scaffolds converted to real, passing assertions: missing header → 401, wrong secret → 401, zero `ad_accounts` → 200 skipped with no insert, eligible tenant → insert called once with `source: 'daily'`
- `n8n-workflows/daily-insights-and-anomaly-detection.json` — single workflow (D-08) structured after `google-ads-sync.json`'s conventions: Schedule Trigger (`0 5 * * *`), Set Constants (`SUPABASE_URL`, `VERCEL_APP_URL` placeholder, `ANOMALY_THRESHOLD_PCT=20`, `WINDOW_HOURS=24`), dedupe-then-loop over tenants with `>= 1 ad_accounts` row, an insights branch (HTTP Request to `/api/insights/daily` via a distinct `N8N Insights Secret` header-auth credential — the only node that reaches Vercel/Claude) and an anomaly branch (`campaign_metrics` read -> Code node computing per-campaign ROAS drop vs the prior date row -> PostgREST insert into `anomaly_alerts`), both branches merged back into the per-tenant loop; `"active": false` pending user import
- Full suite: 23 test files, 183 passed / 1 skipped / 5 todo (down from 21 todo pre-plan — the 4 AI-02 todos this plan filled, plus the pre-existing 1 from another file); the single failure on the combined run (`anomaly_alerts realtime delivery`) is the same pre-existing websocket cold-start flake documented since Plan 02 — isolated re-run 7/7 passed, confirmed not a regression
- `npx tsc --noEmit` and `npm run build` both clean (same 2 pre-existing, unrelated `vault-rpc.test.ts` errors documented since Plan 02); build output confirms `/api/insights/daily` compiles as a dynamic route

## Task Commits

1. **Task 1: app/api/insights/daily/route.ts (fill insights-daily-route.test.ts)** - `94b7766` (feat)
2. **Task 2: n8n-workflows/daily-insights-and-anomaly-detection.json (single workflow, D-08)** - `7064f8f` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `app/api/insights/daily/route.ts` - N8N-triggered daily route: shared-secret gate, `ad_accounts` eligibility check, `generateText`, auto-persist `source='daily'`
- `tests/unit/insights-daily-route.test.ts` - 4 real assertions (was 4 `it.todo()` + sanity check)
- `n8n-workflows/daily-insights-and-anomaly-detection.json` - single N8N workflow: insights-generation branch + ROAS anomaly-detection branch, 05:00 UTC, `active: false`

## Decisions Made

- Executed the plan's provided route code verbatim for Task 1 (no deviation).
- Task 2's workflow JSON was written from the plan's prose spec (no literal JSON block given) — designed the anomaly branch's Code node to compare each campaign's two most-recent `campaign_metrics` date rows (current vs prior), since the table is date-grain, not timestamp-grain; this is the natural interpretation of "most recent 24h ROAS vs the prior 24h ROAS" given the existing schema (Plan 02/campaign_metrics, migration 0007).
- Added a "Merge branches" node (`n8n-nodes-base.merge`, append mode) joining the insights branch and the anomaly branch back into the shared per-tenant `splitInBatches` loop — not explicitly specified in the plan's prose but necessary for a well-formed N8N loop with two parallel per-tenant branches (mirrors the single-branch loop-back pattern in `google-ads-sync.json`, extended for the two-branch case).

## Deviations from Plan

None requiring user decision. One documented judgment call already noted above (Merge node addition, Rule 3 — blocking/structural necessity to close the loop correctly, not an architectural change to the plan's design).

**Anomaly-detection-location decision recorded (per plan's explicit instruction):** ROAS-drop detection lives entirely in the N8N workflow's Code node (D-05), not in a Postgres function and not in the `/api/insights/daily` route. Consequently `tests/unit/roas-anomaly-detection.test.ts` (mentioned as optional in 04-RESEARCH.md's file map) was deliberately NOT created — N8N Function-node JS embedded in a workflow JSON has no meaningful Vitest harness outside a running N8N instance.

## Issues Encountered

- Full-suite run showed 1 failing test (`anomaly_alerts realtime delivery`, `tests/unit/anomaly-alerts-schema.test.ts`) — the same pre-existing websocket cold-start flake documented since Plan 02's SUMMARY. Re-ran the file in isolation immediately after: 7/7 passed. Not a regression — this plan's files never touch `anomaly_alerts` schema/RLS/Realtime (Plan 02's scope); the workflow only inserts rows into the already-live table via PostgREST.
- A grep-based acceptance check for "no native `n8n-nodes-base.supabase` node" returned 1 match — it is the literal string inside an explanatory `notes` field on the "Insert anomaly_alerts" node (documenting *why* PostgREST is used instead), not an actual node `type`. Confirmed via a second, more precise grep restricted to `"type": "n8n-nodes-base...."` fields, which shows only `scheduleTrigger`/`set`/`httpRequest`/`code`/`splitInBatches`/`merge` — same class of grep false-positive already documented as a non-issue precedent in Phase 05 Plan 07's SUMMARY.

## User Setup Required

Per the plan's `user_setup` frontmatter — required before the daily job can run live:

1. **Generate `N8N_INSIGHTS_SECRET`** (a random secret) and add it to:
   - Vercel Dashboard → Environment Variables → `N8N_INSIGHTS_SECRET` (Production + Preview + Development, server-only, no `NEXT_PUBLIC_` prefix)
   - N8N → an HTTP Header Auth credential named exactly `N8N Insights Secret` (header name `x-n8n-secret`, value = the same secret) — used by the workflow's "Call insights daily route" node
2. **Import `n8n-workflows/daily-insights-and-anomaly-detection.json`** into N8N (Workflows → Import from File), wire both credentials (`Supabase Service Role` — already exists from the sync workflows; `N8N Insights Secret` — new, per step 1), replace the `VERCEL_APP_URL` placeholder in the "Set Constants" node with the real production deployment URL, then activate the workflow.
3. This is unchanged from the carried-over Phase 4 blocker: `ANTHROPIC_API_KEY` must also be present on Vercel (Production + Preview + Development) before this route can make a real Claude call in production — local `.env.local` already has it (per Plan 03's SUMMARY).

## Next Phase Readiness

- Phase 4 (AI Insights) is now code-complete: all 6 plans executed. AI-01/AI-03 (Plan 04), AI-04's frontend half (Plan 05), and AI-02 + AI-04's detection half (this plan) are all implemented.
- `requirements mark-complete` will be run for AI-02 and AI-04 as part of this plan's state update — AI-04 was intentionally withheld in Plan 05 pending this plan's detection half; that half now exists in code.
- **Still outstanding (manual, per 04-VALIDATION.md, not automatable in this execution session):** import + activate the N8N workflow live (needs the VPS N8N instance + real credentials), confirm a real 05:00 UTC execution produces both an `ai_insights` row (`source='daily'`) and, for a tenant with a genuine >20% ROAS drop, an `anomaly_alerts` row that triggers the in-app toast/badge from Plan 05. This is the final live verification step for the whole Phase 4 gap-closure effort.
- No blockers for closing Phase 4.

---
*Phase: 04-ai-insights*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: app/api/insights/daily/route.ts
- FOUND: n8n-workflows/daily-insights-and-anomaly-detection.json
- FOUND: tests/unit/insights-daily-route.test.ts
- FOUND: .planning/phases/04-ai-insights/04-06-SUMMARY.md
- FOUND commit: 94b7766 (Task 1)
- FOUND commit: 7064f8f (Task 2)
