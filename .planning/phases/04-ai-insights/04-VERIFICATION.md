---
phase: 04-ai-insights
verified: 2026-07-11T15:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On-demand streaming UI visual behavior"
    expected: "Clicking 'Analisar agora' streams Claude's text token-by-token into the StreamingInsightCard, then the completed insight appears in the history list without a page refresh"
    why_human: "Streaming/visual behavior is not covered by this project's node-environment Vitest setup (no @testing-library/react); code path is verified statically (fetch + reader loop + refetch) but the live token-by-token UX needs a browser"
  - test: "Supabase Realtime anomaly alert delivery (toast + sidebar badge, no refresh)"
    expected: "Inserting a row into anomaly_alerts for the active tenant fires a toast (AlertTriangle + --chart-5 left border) and increments the sidebar badge, live, with no page refresh"
    why_human: "WebSocket subscription behavior requires a live Supabase project and a real browser runtime; the unit suite verifies the Realtime *publication membership* and payload delivery to a Node subscriber, not the actual toast/badge render"
  - test: "Realtime RLS enforcement over postgres_changes (A3) — non-super_admin receives nothing"
    expected: "A non-super_admin session subscribed to the same anomaly_alerts channel receives zero events; a super_admin session receives the INSERT"
    why_human: "Requires two concurrent live browser/websocket sessions with different roles; cannot be simulated in the mocked/service-role test harness"
  - test: "N8N daily job fires at 05:00 UTC and produces real ai_insights/anomaly_alerts rows end-to-end"
    expected: "After importing and activating n8n-workflows/daily-insights-and-anomaly-detection.json (with N8N_INSIGHTS_SECRET wired on both sides and VERCEL_APP_URL set to the real deployment URL), the workflow runs at 05:00 UTC, calls /api/insights/daily for each eligible tenant, and inserts anomaly_alerts rows for genuine >20% ROAS drops"
    why_human: "Requires the live self-hosted N8N VPS instance, real credentials, and an actual scheduled execution — the workflow JSON is currently inactive (active: false) pending user import, which is explicitly deferred to user_setup, not part of this execution session"
---

# Phase 4: AI Insights Verification Report

**Phase Goal:** Super Admin can trigger on-demand AI analysis of campaign performance and view a history of all generated recommendations, with automatic daily analysis and in-app anomaly alerts running without manual action.
**Verified:** 2026-07-11T15:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Super Admin can click a button on the dashboard to trigger on-demand analysis; Claude returns structured insights (type, priority/impact, recommended action) within the Vercel timeout using streaming | VERIFIED | `AiShortcutCard` (dashboard) + CTA on `/insights` both call `handleGenerate` → `POST /api/insights/generate` (`streamText`, `maxDuration=60`, super_admin-gated); `onFinish` parses `<insight_data>` and inserts one `ai_insights` row with fallback-on-parse-failure. `tests/unit/insights-generate-route.test.ts` (8/8 real assertions) and `tests/unit/parse-insight-block.test.ts` (9/9) pass live |
| 2 | N8N runs a scheduled daily analysis at 05:00 UTC after both sync workflows complete; results are stored to the database and visible without any manual trigger | VERIFIED (code) / PENDING (live activation) | `app/api/insights/daily/route.ts` implements the shared-secret gate + D-07 eligibility + `generateText` + `source='daily'` insert, all covered by `tests/unit/insights-daily-route.test.ts` (5/5 passing). `n8n-workflows/daily-insights-and-anomaly-detection.json` is valid JSON, cron `0 5 * * *`, calls the route per eligible tenant — but `"active": false`, pending user import into the live N8N VPS (tracked as `user_setup` in 04-06-PLAN.md, not a code gap) |
| 3 | The AI Insights history page lists all generated insights with type, priority, recommended action, impact, and generation timestamp — accessible only to Super Admin | VERIFIED | `app/[tenant-slug]/insights/page.tsx` renders real `ai_insights` rows via `useAiInsights` (tenant-scoped join on `tenants.slug`); `InsightCard` shows type badge, impact, recommendations, `formatDate(createdAt)`. Page redirects non-super_admin to `/dashboard` via `useUserRole()` (fixed in WR-03); sidebar nav item and dashboard shortcut also hidden for non-super_admin roles |
| 4 | When ROAS for any campaign drops more than 20% within a 24-hour window, an in-app anomaly alert appears for the Super Admin without requiring a page refresh or manual analysis trigger | VERIFIED (code) / PENDING (live E2E) | `anomaly_alerts` table live with super_admin-only RLS + `supabase_realtime` publication membership (confirmed by `tests/unit/anomaly-alerts-schema.test.ts` 7/7, including a live subscribe+insert+receive behavioral check). `use-anomaly-alerts.tsx` subscribes once via `AnomalyListener` (mounted only for super_admin in `layout.tsx`), fires `toast.custom()` + increments the shared Zustand store; sidebar badge reflects unread count and clears on visit. The N8N Code node that computes the >20% ROAS drop and inserts the row is written but not yet live-activated (same pending-activation caveat as Truth 2) |

**Score:** 4/4 truths verified at the code level; 2 of the 4 carry an explicit "pending live activation/E2E" caveat that is a deployment/ops step (N8N import), not a code defect.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/ai/anthropic.ts` | `MODEL_ID`/`insightModel` singleton | VERIFIED | Exports `claude-sonnet-4-6` + `insightModel` |
| `lib/ai/parse-insight-block.ts` | `extractStructuredBlock`/`stripStructuredBlock` | VERIFIED | Zod-validated, never throws; 9/9 tests pass |
| `lib/ai/insight-prompt.ts` | `buildOnDemandPrompt`/`buildDailyPrompt`/`resolveTenantId` | VERIFIED | Aggregates real `daily_rollups` + `campaign_metrics` (30d), derives ROAS/CPA/CTR, wraps in `<campaign_data>` |
| `app/api/insights/generate/route.ts` | On-demand streaming route (AI-01) | VERIFIED | super_admin-gated, `streamText`, auto-persist + fallback, insert-error now logged (WR-02 fix) |
| `app/api/insights/daily/route.ts` | N8N daily route (AI-02) | VERIFIED | shared-secret gate (constant-time compare, WR-04 fix), D-07 eligibility, `generateText`, insert-error surfaced as 500 (WR-01 fix) |
| `supabase/migrations/0021_create_ai_insights.sql` | `ai_insights` table + RLS | VERIFIED | Live in prod (confirmed via passing RLS integration test against real Supabase project) |
| `supabase/migrations/0022_create_anomaly_alerts.sql` | `anomaly_alerts` table + RLS + Realtime | VERIFIED | Live in prod; `ALTER PUBLICATION` present and behaviorally confirmed (subscribe+insert+receive) |
| `lib/hooks/use-ai-insights.ts` | TanStack Query hook, real data | VERIFIED | Queries `ai_insights` joined on `tenants.slug`, no mock/static fallback |
| `components/insights/streaming-insight-card.tsx` | Streaming/completing/error card | VERIFIED | Three states, UI-SPEC colors, `aria-live`, retry button |
| `components/dashboard/ai-shortcut-card.tsx` | Dashboard shortcut (D-02) | VERIFIED | Navigates to `/insights?trigger=1`; gated to `super_admin` (WR-03 fix) |
| `app/[tenant-slug]/insights/page.tsx` | Real-data page, no `MOCK_INSIGHTS` | VERIFIED | `MOCK_INSIGHTS` import removed; XSS vector removed (CR-01); unmount-safe streaming (WR-05) |
| `lib/stores/anomaly-alerts.ts` | Zustand unread store | VERIFIED | Single source of truth for badge + toast trigger |
| `lib/hooks/use-anomaly-alerts.tsx` | Realtime subscription + toast | VERIFIED | Single subscription, `toast.custom()`, `--chart-5` accent, whole-body click |
| `components/insights/anomaly-listener.tsx` | Single mount point | VERIFIED | Mounted once in `layout.tsx`, super_admin-only |
| `components/layout/sidebar-nav.tsx` | Unread badge + clear-on-visit + role gate | VERIFIED | Badge conditional (`>0`), clears on `/insights` visit, `insights` item hidden for non-super_admin (WR-03 fix) |
| `n8n-workflows/daily-insights-and-anomaly-detection.json` | Single workflow (D-08) | VERIFIED (structure) | Valid JSON, cron `0 5 * * *`, insights + anomaly branches, no native Supabase node, `active: false` pending import |
| `vercel.json` | `maxDuration=60` for both insight routes | VERIFIED | Both routes present alongside existing `regions` |
| `types/database.types.ts` | `ai_insights`/`anomaly_alerts` types | VERIFIED | Regenerated, compiles clean |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `insights/page.tsx` | `/api/insights/generate` | `fetch` + `res.body` reader | WIRED | Confirmed by code read + build; streaming loop is abort/unmount-safe |
| `use-ai-insights.ts` | `ai_insights` table | `supabase.from('ai_insights')` join | WIRED | Live query, RLS-scoped |
| `ai-shortcut-card.tsx` | `insights/page.tsx` | `router.push(...?trigger=1)` | WIRED | Ref-guarded auto-trigger on mount, param stripped after |
| `use-anomaly-alerts.tsx` | `anomaly_alerts` (Realtime) | `postgres_changes` INSERT | WIRED | Behaviorally confirmed live (subscribe+insert+receive test) |
| `sidebar-nav.tsx` | `anomaly-alerts.ts` store | `useAnomalyAlertsStore` | WIRED | Badge count + `clearUnread` on visit |
| `layout.tsx` | `anomaly-listener.tsx` | conditional mount (super_admin + tenantId) | WIRED | Confirmed in code |
| `n8n-workflows/...json` | `/api/insights/daily` | HTTP Request + `x-n8n-secret` | WIRED (structurally) | Route validated by unit tests; workflow activation pending (ops task) |
| `app/api/insights/daily/route.ts` | `ai_insights` table | service client insert `source='daily'` | WIRED | Insert-error now surfaced (WR-01 fix) |
| `n8n-workflows/...json` | `anomaly_alerts` table | PostgREST insert | WIRED (structurally) | No native Supabase node used (GitHub #17020 avoided); live insert path shares the confirmed-live `anomaly_alerts` table |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `insights/page.tsx` | `insights` (from `useAiInsights`) | `ai_insights` table via Supabase join | Yes — live DB query, no static fallback | FLOWING |
| `insight-prompt.ts` aggregation | `channels`/`campaigns` | `daily_rollups` + `campaign_metrics` (real tables, 30d window) | Yes | FLOWING |
| `streaming-insight-card.tsx` | `text` prop | Accumulated stream from `/api/insights/generate` | Yes — real Claude stream, not a static string | FLOWING |
| `sidebar-nav.tsx` badge | `unread` | `useAnomalyAlertsStore`, incremented by live Realtime INSERT | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| AI-insights test files pass against live Supabase project (RLS, schema, publication) | `npx vitest run tests/integration/ai-insights-rls.test.ts tests/unit/anomaly-alerts-schema.test.ts` | 7/7 + 7/7 passed | PASS |
| Route auth/role/secret gates | `npx vitest run tests/unit/insights-generate-route.test.ts tests/unit/insights-daily-route.test.ts` | 8/8 + 5/5 passed | PASS |
| Parser fallback logic | `npx vitest run tests/unit/parse-insight-block.test.ts` | 9/9 passed | PASS |
| Full suite regression | `npm test` | 23 files, 184 passed, 1 skipped, 5 todo (all 5 remaining todos are in pre-existing `tests/rls.test.ts`, unrelated to Phase 4) | PASS |
| Type-check | `npx tsc --noEmit` | Only 2 pre-existing, documented-unrelated errors in `tests/integration/vault-rpc.test.ts` (Phase 2, tracked in STATE.md) | PASS |
| Production build | `npm run build` | Compiled successfully; `/api/insights/generate`, `/api/insights/daily`, `/insights` all present as routes | PASS |
| N8N workflow JSON structure | `node -e "JSON.parse(...)"` + grep | Valid JSON; cron `0 5 * * *`; no native `n8n-nodes-base.supabase` node type used | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AI-01 | 04-03, 04-04 | On-demand trigger button; streaming; structured result | SATISFIED | Route + UI both live, gated, tested |
| AI-02 | 04-06 | N8N scheduled daily analysis at 05:00 UTC, stored to DB | SATISFIED (code) — live activation pending, tracked as user_setup, not a gap | Route + workflow JSON complete; awaiting N8N import per 04-06-SUMMARY.md |
| AI-03 | 04-02, 04-04 | History page, super_admin-only | SATISFIED | Page + role gate (WR-03) + RLS all confirmed |
| AI-04 | 04-02, 04-05, 04-06 | In-app anomaly alert, ROAS >20%/24h, no refresh | SATISFIED (code) — live E2E + N8N activation pending | Toast/badge/Realtime all live-tested at the infra level; N8N detection branch awaits activation |

No orphaned requirements — all four IDs (AI-01..AI-04) declared across the phase's plan frontmatter map 1:1 to REQUIREMENTS.md's Phase 4 row, which already reads "Complete" for all four.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/[tenant-slug]/insights/page.tsx` | 117 (pre-fix) | `dangerouslySetInnerHTML` on AI-generated value (CR-01) | 🛑 Blocker (fixed) | Stored XSS — **fixed** in commit `9b26309`, confirmed removed on read |
| `app/api/insights/daily/route.ts` | 48-57 (pre-fix) | Silent insert-error swallowing (WR-01) | ⚠️ Warning (fixed) | Lost daily insight, no observability — **fixed** in commit `e1547ac` |
| `app/api/insights/generate/route.ts` | 47-61 (pre-fix) | Silent insert-error swallowing (WR-02) | ⚠️ Warning (fixed) | Lost on-demand insight, no observability — **fixed** in commit `1df5c1a` |
| `sidebar-nav.tsx` / `dashboard/page.tsx` / `insights/page.tsx` (pre-fix) | — | AI Insights UI reachable by non-super_admin (WR-03) | ⚠️ Warning (fixed) | UX/authorization gap (RLS/route already blocked data) — **fixed** in commit `2040017` |
| `app/api/insights/daily/route.ts` | 15 (pre-fix) | Non-constant-time secret comparison (WR-04) | ⚠️ Warning (fixed) | Timing side-channel — **fixed** in commit `bc2de22` |
| `insights/page.tsx` | 162-202 (pre-fix) | No cleanup on unmount for streaming fetch (WR-05) | ⚠️ Warning (fixed) | React state-after-unmount / race — **fixed** in commit `ac0adb6` |

All findings from `04-REVIEW.md` (1 critical, 5 warning) were addressed in `04-REVIEW-FIX.md` (commit range `9b26309`..`b8e32e1`) and independently re-confirmed by direct code read during this verification (not just trusting the fix report). `IN-01` (info: `AiInsight` type sourced from `lib/mock-data.ts`) was correctly left unfixed as out-of-scope for a critical/warning-only fix pass — no functional impact, purely a maintainability note.

### Human Verification Required

### 1. On-demand streaming UI (visual)

**Test:** Log in as super_admin, click "Analisar agora" from both the Insights page and the dashboard shortcut card.
**Expected:** Text streams progressively (token-by-token) into the blue-accented streaming card, then transitions to a green "completing" state and the finished insight appears at the top of the history list without a page refresh.
**Why human:** No `@testing-library/react`/browser environment in this project's Vitest config; the fetch/reader/state logic is verified by code read and `tsc`/build, not by an automated render test.

### 2. Anomaly toast + badge live delivery

**Test:** While logged in as super_admin, insert a row into `anomaly_alerts` for the active tenant (or trigger the N8N job against seeded data with a genuine >20% ROAS drop).
**Expected:** A toast with an `AlertTriangle` icon and 3px `--chart-5` left border appears immediately (no refresh); the sidebar "AI Insights" badge increments; clicking anywhere on the toast body navigates to `/insights`; visiting `/insights` clears the badge.
**Why human:** Requires a live Supabase Realtime WebSocket connection in an actual browser session.

### 3. Realtime RLS enforcement over `postgres_changes` (A3)

**Test:** Open two concurrent sessions — one super_admin, one non-super_admin (tenant_admin/viewer/agency) — both subscribed to `anomaly_alerts`; insert a row.
**Expected:** Only the super_admin session receives the event; the non-super_admin session receives nothing, even though the client-side `filter` alone would not enforce this.
**Why human:** Requires two live, concurrently authenticated browser sessions; cannot be simulated by the service-role/mocked test harness used in this repo.

### 4. N8N daily job live execution

**Test:** Import `n8n-workflows/daily-insights-and-anomaly-detection.json` into the production N8N instance, wire the `Supabase Service Role` and `N8N Insights Secret` (header `x-n8n-secret`) credentials, replace the `VERCEL_APP_URL` placeholder, add `N8N_INSIGHTS_SECRET`/`ANTHROPIC_API_KEY` to the Vercel Dashboard, and activate the workflow.
**Expected:** At the next 05:00 UTC run, N8N's execution history shows the workflow completed, an `ai_insights` row (`source='daily'`) exists for each eligible tenant, and any tenant with a genuine >20% ROAS drop gets an `anomaly_alerts` row.
**Why human:** Requires the live self-hosted N8N VPS, real credentials, and waiting for (or manually triggering) a scheduled execution — explicitly called out as a deploy/ops step in `04-06-SUMMARY.md`'s "User Setup Required" section, not something this execution session could perform.

### Gaps Summary

No code-level gaps were found. All four AI Insights requirements (AI-01 through AI-04) are implemented, wired to real data end-to-end, covered by passing automated tests running against the live Supabase project, and pass `tsc`/`npm run build`/`npm test` with zero regressions. A prior code review (`04-REVIEW.md`) found one critical (XSS) and five warning-level issues; all six were fixed in `04-REVIEW-FIX.md` and independently re-verified here by direct code inspection (not just trusting the fix report's claims).

The only items remaining are genuine "cannot be automated" human/live checks: (1) visual confirmation of the token-by-token streaming UX, (2) live Realtime toast/badge delivery in a real browser, (3) Realtime-over-RLS enforcement across two concurrent sessions, and (4) activating the N8N workflow on the production VPS and observing a real 05:00 UTC run. These are exactly the items the phase's own `04-VALIDATION.md` flagged in advance as "Manual-Only Verifications" — they are deployment/live-environment steps, not missing code, and do not block the phase from being considered code-complete.

---

*Verified: 2026-07-11T15:00:00Z*
*Verifier: Claude (gsd-verifier)*
