---
phase: 04-ai-insights
plan: 04
subsystem: ui
tags: [tanstack-query, streaming, nextjs-app-router, react-client-component]

# Dependency graph
requires:
  - phase: 04-ai-insights (Plan 02)
    provides: "ai_insights table live with super_admin-only RLS"
  - phase: 04-ai-insights (Plan 03)
    provides: "POST /api/insights/generate — streaming Route Handler that auto-persists to ai_insights"
provides:
  - "lib/hooks/use-ai-insights.ts — useAiInsights(tenantSlug) TanStack Query hook, joins ai_insights on tenants.slug"
  - "components/insights/streaming-insight-card.tsx — StreamingInsightCard (streaming/completing/error states, UI-SPEC Element 1)"
  - "components/dashboard/ai-shortcut-card.tsx — AiShortcutCard (dashboard on-demand shortcut, UI-SPEC Element 4)"
  - "app/[tenant-slug]/insights/page.tsx rewritten — real data, streaming trigger, trigger=1 auto-invoke, empty/error states"
  - "app/[tenant-slug]/dashboard/page.tsx — AiShortcutCard inserted between KPI grid and Charts Row"
affects: ["04-ai-insights Plan 06 (daily job) — no direct dependency, but both write to the same ai_insights history list this plan renders"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side fetch + res.body.getReader()/TextDecoder to progressively render a streamed Route Handler response (no extra streaming library on the client — the Vercel AI SDK's streamText on the server is consumed as a plain text stream)"
    - "Trigger-via-searchParam pattern: a secondary entry point (dashboard shortcut) deep-links into the primary page with ?trigger=1, which the primary page reads once (ref-guarded) on mount, invokes the same handler its own CTA uses, then strips the param via router.replace — avoids a second independent call site for the same action (D-02)"

key-files:
  created:
    - lib/hooks/use-ai-insights.ts
    - components/insights/streaming-insight-card.tsx
    - components/dashboard/ai-shortcut-card.tsx
  modified:
    - app/[tenant-slug]/insights/page.tsx
    - app/[tenant-slug]/dashboard/page.tsx

key-decisions:
  - "Rendered <StreamingInsightCard state={streamState} .../> without a TS cast — narrowing streamState !== 'idle' inside the JSX && expression is enough for TypeScript to exclude 'idle' from the prop type; kept the exact grep-target string `state={streamState}` intact instead of the plan's alternative of a manual cast"
  - "Displayed streamed text is computed by splitting the accumulated buffer on the literal string '<insight_data>' every chunk (full.split('<insight_data>')[0]) rather than incrementally stripping tags — cheap given expected response sizes (a few KB of prose) and avoids a stateful parser for a one-time split point"

requirements-completed: [AI-01, AI-03]

# Metrics
duration: ~10min
completed: 2026-07-11
---

# Phase 04 Plan 04: On-Demand AI Insights UI Summary

**Wired the existing mock insights UI to real Supabase data and Plan 03's streaming Route Handler: `useAiInsights` replaces `MOCK_INSIGHTS`, a new `StreamingInsightCard` renders Claude's token-by-token output live, and a second "Analisar agora" entry point on the dashboard deep-links into the same generation flow.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-11T13:40:00Z (approx.)
- **Completed:** 2026-07-11T13:52:36Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `lib/hooks/use-ai-insights.ts` exports `useAiInsights(tenantSlug)` — TanStack Query hook querying `ai_insights` joined on `tenants!inner(slug)`, filtered by `.eq('tenants.slug', tenantSlug)`, ordered newest-first, mapped to the existing `AiInsight` shape (`created_at` → `createdAt`)
- `components/insights/streaming-insight-card.tsx` exports `StreamingInsightCard` — three states (`streaming`/`completing`/`error`) per UI-SPEC Element 1: identical shell/colors to `TYPE_CONFIG.opportunity`, pulsing badge dot, blinking text cursor while streaming, `CheckCircle2`/green tint on completion, `AlertTriangle`/red tint + "Tentar novamente" retry button on error, `aria-live="polite"` on the text container
- `app/[tenant-slug]/insights/page.tsx` rewritten: `MOCK_INSIGHTS` import removed entirely; `InsightCard`/`TYPE_CONFIG`/`IMPACT_CONFIG`/`formatDate` preserved verbatim; CTA relabeled "Analisar agora"; `handleGenerate` POSTs to `/api/insights/generate`, reads the response via `getReader()`/`TextDecoder`, accumulates text (stripping the `<insight_data>` tail) into `StreamingInsightCard`, then after a 600ms "completing" beat calls `refetch()` and clears back to idle — no page refresh; added loading/error/empty states for the history list; reads `?trigger=1` on mount (ref-guarded against re-fire) to auto-invoke generation from the dashboard shortcut, then strips it via `router.replace`
- `components/dashboard/ai-shortcut-card.tsx` exports `AiShortcutCard` — full-width `Card` with the "Análise sob demanda" copy and a CTA reusing the exact class string from the insights page button; click navigates to `/${tenantSlug}/insights?trigger=1`
- `app/[tenant-slug]/dashboard/page.tsx` renders `<AiShortcutCard tenantSlug={tenantSlug} />` between the KPI grid and the Charts Row
- `npx tsc --noEmit` and `npm run build` both clean (only the 2 pre-existing unrelated `vault-rpc.test.ts` errors, documented since Plan 02)
- Full test suite: 179 passed / 1 skipped / 9 todo, with the same pre-existing `anomaly_alerts` realtime websocket cold-start flake documented since Plan 02 — re-ran in isolation and it passed 7/7, confirming no regression

## Task Commits

1. **Task 1: lib/hooks/use-ai-insights.ts + components/insights/streaming-insight-card.tsx** - `7fae248` (feat)
2. **Task 2: Rewrite app/[tenant-slug]/insights/page.tsx** - `4c3877f` (feat)
3. **Task 3: components/dashboard/ai-shortcut-card.tsx + insert into dashboard page** - `fc9bb4d` (feat)

**Plan metadata:** (this commit, pending)

_Note: all three tasks were standard `auto` tasks, no TDD flag._

## Files Created/Modified
- `lib/hooks/use-ai-insights.ts` - `useAiInsights` TanStack Query hook, tenant-scoped `ai_insights` read
- `components/insights/streaming-insight-card.tsx` - `StreamingInsightCard`, three-state streaming display
- `app/[tenant-slug]/insights/page.tsx` - real data, streaming CTA flow, trigger param, empty/error states
- `components/dashboard/ai-shortcut-card.tsx` - `AiShortcutCard`, dashboard on-demand entry point
- `app/[tenant-slug]/dashboard/page.tsx` - inserted `AiShortcutCard` between KPI grid and Charts Row

## Decisions Made
- Removed the plan's suggested `state={streamState as StreamingInsightCardState}` cast in favor of relying on TypeScript's control-flow narrowing inside `{streamState !== 'idle' && (...)}` — compiles clean without a cast and keeps the literal `state={streamState}` string the acceptance-criteria grep targets.
- `handleGenerate`'s displayed text is derived by splitting the full accumulated buffer on `'<insight_data>'` on every chunk (not an incremental/streaming-safe parser) — acceptable because the structured data block is appended once, at the very end of the model's response, per Plan 03's prompt design.

## Deviations from Plan

None - plan executed exactly as written. The only difference from the plan's literal code sketch is the omitted TS cast noted above, which is a strict improvement (same behavior, no cast, same grep target satisfied).

## Issues Encountered
None. The pre-existing `anomaly_alerts` realtime flake (documented since Plan 02) reappeared on the combined full-suite run and was reconfirmed as unrelated via an isolated re-run (7/7 passed).

## User Setup Required

None for local development. `ANTHROPIC_API_KEY` deployment-to-Vercel step remains outstanding from Plan 02/03 (unchanged, not a blocker for this plan) — still needed before `/api/insights/generate` works in production.

## Next Phase Readiness
- AI-01 and AI-03 requirements are now genuinely complete: the dashboard button (AI-01's literal wording) and the tenant-filtered history list (AI-03) both exist and are wired to live data.
- Manual UAT (per `04-VALIDATION.md`) remains outstanding: log in as super_admin, click "Analisar agora" from both locations, confirm progressive streaming + auto-appear in history without refresh; verify empty state on a fresh tenant.
- No blockers identified for Plan 06 (daily N8N job) — it shares `lib/ai/` core with Plan 03 and does not depend on this plan's UI.

---
*Phase: 04-ai-insights*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: lib/hooks/use-ai-insights.ts
- FOUND: components/insights/streaming-insight-card.tsx
- FOUND: components/dashboard/ai-shortcut-card.tsx
- FOUND: app/[tenant-slug]/insights/page.tsx
- FOUND: app/[tenant-slug]/dashboard/page.tsx
- FOUND: .planning/phases/04-ai-insights/04-04-SUMMARY.md
- FOUND commit: 7fae248
- FOUND commit: 4c3877f
- FOUND commit: fc9bb4d
