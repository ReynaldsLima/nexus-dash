# Phase 4: AI Insights - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers three interconnected capabilities built on top of the Fase 3 dashboard:

1. **On-demand AI analysis** — Super Admin triggers Claude analysis via streaming, result appears inline and is persisted automatically.
2. **Automated daily analysis** — Single N8N job at 05:00 UTC generates insights AND detects ROAS anomalies for all tenants with configured ad accounts.
3. **Anomaly alerts** — ROAS drop >20% in 24h triggers an in-app alert (toast + sidebar badge) delivered via Supabase Realtime without page refresh.

This phase does NOT add: new data sources, cross-tenant consolidated views, email/push notifications, manual alert acknowledgment workflows.

</domain>

<decisions>
## Implementation Decisions

### Streaming — On-Demand Analysis
- **D-01:** Use Vercel AI SDK `streamText` for on-demand analysis. Text appears progressively token-by-token inline on the Insights page. Eliminates Vercel Hobby 60s timeout risk.
- **D-02:** "Analisar agora" button appears in **two places**: (a) primary button on `/[tenant-slug]/insights` page, (b) shortcut card/badge on the main dashboard. Both trigger the same Route Handler.
- **D-03:** Insight is **saved automatically** to Supabase when the stream completes — no explicit "Save" button. Appears immediately in the history list below.
- **D-12:** The streaming output appears **inline on the Insights page** (not in a Sheet). A card/area at the top shows the generating text. After completion, it merges into the history list.

### Anomaly Alerts
- **D-04:** **Supabase Realtime** (WebSocket subscription) delivers alerts to the frontend without page refresh. No polling needed.
- **D-05:** **N8N detects** ROAS anomalies (>20% drop in 24h per campaign). When detected, N8N inserts a row into an `anomaly_alerts` table. Supabase Realtime fires the frontend subscription.
- **D-06:** Alert UI: **toast immediately** when alert arrives + **persistent badge on "Insights" sidebar link** until the Super Admin visits the page. Both together ensure the alert is not missed.

### N8N Daily Job
- **D-07:** Daily job at 05:00 UTC covers **all tenants that have at least one configured `ad_accounts` row**. Uses last 30 days of `daily_rollups` per tenant. Skips tenants with no connected channels.
- **D-08:** **Single N8N workflow** handles both: (a) daily insights generation AND (b) ROAS anomaly detection. Avoids duplicating the data-fetch logic between two separate crons.
- **D-09:** Claude receives a **concise aggregated JSON** (totals and averages per channel and per campaign for last 30 days), NOT raw row-level data. Keeps token usage low and stays within context limits.

### Insights Page Wiring
- **D-10:** **Keep the existing UI** from `app/[tenant-slug]/insights/page.tsx`. Replace `MOCK_INSIGHTS` import with TanStack Query fetching from the real `ai_insights` Supabase table. The `AiInsight` type in `lib/mock-data.ts` defines the schema contract.
- **D-11:** History view is **filtered by the active tenant** (`/[tenant-slug]/insights`). Super Admin switches tenants via the header TenantSwitcher to see another tenant's insights. No consolidated cross-tenant view in this phase.

### Claude's Discretion
- Exact prompt template for on-demand vs daily analysis (researcher will define based on REQUIREMENTS.md)
- DB schema for `ai_insights` and `anomaly_alerts` tables (planner decides columns based on the `AiInsight` type and anomaly requirements)
- How N8N calls the Claude API (direct via HTTP node or via a Next.js Route Handler as proxy)
- Supabase Realtime channel name and filter configuration
- Exact toast duration and badge clear mechanism (seen when page visited)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing implementation to preserve
- `app/[tenant-slug]/insights/page.tsx` — UI to keep; replace mock with real data
- `lib/mock-data.ts` — `AiInsight` type definition is the schema contract for the DB table
- `components/layout/sidebar-nav.tsx` — Badge must be added here for anomaly alert count

### Phase context and requirements
- `.planning/REQUIREMENTS.md` — AI-01, AI-02, AI-03, AI-04 requirements
- `.planning/ROADMAP.md` §Phase 4 — Success criteria (streaming within Vercel timeout, N8N 05:00 UTC, history page, 20% ROAS drop alert)
- `.planning/phases/03-dashboard-ui/03-CONTEXT.md` — Established patterns (Sheet, no outside-click-close, TanStack Query, Zustand)
- `.planning/phases/02-data-pipeline/02-CONTEXT.md` — N8N patterns and Supabase write strategy

### Stack references (already in codebase)
- `lib/hooks/use-dashboard-data.ts` — Pattern for Supabase query hooks with RLS isolation
- `lib/hooks/use-campaigns-data.ts` — Pattern for tenant-scoped queries
- `app/api/meta-ads/connect/route.ts` — Pattern for authenticated Route Handlers with role check
- `components/layout/header-actions.tsx` — Client component in header (pattern for adding Realtime subscription here or at layout level)

### No external specs
Vercel AI SDK streaming patterns and Supabase Realtime are documented upstream; researcher should fetch current docs via context7 or web search.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/[tenant-slug]/insights/page.tsx` — Full UI ready; cards with type/impact/recommendations/metrics. Replace import only.
- `lib/mock-data.ts:AiInsight` — Type contract for the real DB table columns
- `lib/hooks/use-dashboard-data.ts` and `use-campaigns-data.ts` — Copy pattern for `useAiInsights` and `useAnomalyAlerts` hooks
- `app/api/meta-ads/connect/route.ts` — Route Handler pattern (auth → role check → Zod → business logic → Supabase)
- `components/campanhas/campaign-sheet.tsx` — Not reused in this phase (stream goes inline, not Sheet)
- `components/layout/sidebar-nav.tsx` — Add badge/counter for unread anomaly alerts

### Established Patterns
- **TanStack Query** for all client-side data fetching — `useQuery` with `supabase.from()` inside `queryFn`
- **RLS isolation** — no `.eq('tenant_id')` in client; tenant_id from JWT via RLS
- **Route Handlers** for server-side operations requiring service role or Claude API calls
- **`'use client'`** wrapper components for interactive elements (Zustand, hooks, event handlers)

### Integration Points
- New Route Handler: `app/api/insights/generate/route.ts` — streaming endpoint
- New Supabase tables: `ai_insights`, `anomaly_alerts` (via migration)
- Supabase Realtime: subscribe in layout or a client component in the header area
- N8N: new workflow (or extend existing daily sync workflow) for insights + anomaly detection

</code_context>

<specifics>
## Specific Ideas

- The streaming result card should visually match the existing insight cards (same Card component, same type/impact badge styles from `TYPE_CONFIG` in insights/page.tsx)
- The daily N8N job runs **after** both sync workflows complete (Fase 2 established sync at ~04:30 UTC) — 05:00 UTC is 30 min buffer
- N8N → Claude call: prefer HTTP Request node calling a Next.js Route Handler (keeps Claude API key on Vercel, not in N8N env vars)

</specifics>

<deferred>
## Deferred Ideas

- Cross-tenant consolidated insights view (requires new route or global page)
- Email/push notifications for anomaly alerts (v2 — in-app only for now)
- Manual alert acknowledgment / dismiss workflow
- Insight quality feedback (thumbs up/down rating)
- Per-campaign drill-down from an insight card

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-ai-insights*
*Context gathered: 2026-06-05*
