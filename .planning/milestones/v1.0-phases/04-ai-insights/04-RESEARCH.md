# Phase 4: AI Insights - Research

**Researched:** 2026-07-10
**Domain:** Claude API streaming/structured insights, N8N-triggered server-side analysis, Supabase Realtime alerts
**Confidence:** HIGH (stack/version claims verified via npm registry and current official docs; two items flagged MEDIUM/LOW — see Assumptions Log)

## Summary

Phase 4 has one real, unresolved conflict that this research settles: `04-CONTEXT.md` D-01 locks in the Vercel AI SDK (`streamText`) for the on-demand analysis route, while `CLAUDE.md`/`.planning/research/STACK.md` pin `@anthropic-ai/sdk` as the project's Claude integration library. These are **not the same package family** — `@ai-sdk/anthropic` (verified via `npm view`) has zero dependency on `@anthropic-ai/sdk`; it is an independent implementation of the Anthropic Messages API built on `@ai-sdk/provider`/`@ai-sdk/provider-utils`. Neither package is currently installed (`package.json` has neither `ai`, `@ai-sdk/anthropic`, nor `@anthropic-ai/sdk`), and the one existing Claude call site in this repo (`app/api/leads/chat/route.ts`) uses **plain `fetch()`** against `https://api.anthropic.com/v1/messages` — no SDK at all, and it is non-streaming (`await response.json()`). The task prompt's premise that this file demonstrates "the actual working Anthropic streaming call shape already used in this codebase" is incorrect — there is no existing streaming implementation anywhere in the repo to be consistent with.

Given that, this research recommends: **honor CONTEXT.md D-01 and install `ai` + `@ai-sdk/anthropic`** for the on-demand streaming route. This is the more recent, more specific, user-discussed decision (2026-06-05, after the original stack research from 2026-05-10) and it correctly solves the real problem D-01 names — progressive text on a Hobby-tier function. `@ai-sdk/anthropic` still calls `claude-sonnet-4-6` over the Anthropic API and reads `ANTHROPIC_API_KEY`, so it satisfies CLAUDE.md's **Constraints** section ("AI Provider: Claude (Anthropic) — claude-sonnet-4-6"), which is the non-negotiable part. It does not satisfy the literal package name in the Library Recommendations/Summary Table, which is guidance, not a locked Constraint. **This is a deviation that must be surfaced to the user in `/gsd-discuss-phase` or flagged plainly in the plan** — do not silently pick one. The daily N8N-triggered analysis route has no user-visible streaming requirement (D-08/D-09 — N8N just needs a final JSON result to persist), so it can use either library; for consistency and to avoid maintaining two Claude call patterns, this research recommends the on-demand route and the daily route both go through `ai`/`@ai-sdk/anthropic`, with the daily route using `generateText` (non-streaming) instead of `streamText`.

**Primary recommendation:** Install `ai@^7.0.22` + `@ai-sdk/anthropic@^4.0.12` (verified current versions, compatible peer/dependency graph with the project's `zod@^4.4.3`). Use `streamText` for `POST /api/insights/generate` (on-demand, D-01/D-12), and `generateText` for the N8N-triggered daily job route. Structure the model output as narrative prose with an embedded, delimited structured block (XML-tag style, consistent with the project's existing "XML-tagged data injection" convention) that is parsed out of the accumulated text in `onFinish` — the Vercel AI SDK's `experimental_output`/structured-output-with-tools feature is currently OpenAI-only, so it cannot produce validated JSON while `streamText` is streaming Anthropic prose.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Streaming — On-Demand Analysis**
- D-01: Use Vercel AI SDK `streamText` for on-demand analysis. Text appears progressively token-by-token inline on the Insights page. Eliminates Vercel Hobby 60s timeout risk.
- D-02: "Analisar agora" button appears in two places: (a) primary button on `/[tenant-slug]/insights` page, (b) shortcut card/badge on the main dashboard. Both trigger the same Route Handler.
- D-03: Insight is saved automatically to Supabase when the stream completes — no explicit "Save" button. Appears immediately in the history list below.
- D-12: The streaming output appears inline on the Insights page (not in a Sheet). A card/area at the top shows the generating text. After completion, it merges into the history list.

**Anomaly Alerts**
- D-04: Supabase Realtime (WebSocket subscription) delivers alerts to the frontend without page refresh. No polling needed.
- D-05: N8N detects ROAS anomalies (>20% drop in 24h per campaign). When detected, N8N inserts a row into an `anomaly_alerts` table. Supabase Realtime fires the frontend subscription.
- D-06: Alert UI: toast immediately when alert arrives + persistent badge on "Insights" sidebar link until the Super Admin visits the page. Both together ensure the alert is not missed.

**N8N Daily Job**
- D-07: Daily job at 05:00 UTC covers all tenants that have at least one configured `ad_accounts` row. Uses last 30 days of `daily_rollups` per tenant. Skips tenants with no connected channels.
- D-08: Single N8N workflow handles both: (a) daily insights generation AND (b) ROAS anomaly detection. Avoids duplicating the data-fetch logic between two separate crons.
- D-09: Claude receives a concise aggregated JSON (totals and averages per channel and per campaign for last 30 days), NOT raw row-level data. Keeps token usage low and stays within context limits.

**Insights Page Wiring**
- D-10: Keep the existing UI from `app/[tenant-slug]/insights/page.tsx`. Replace `MOCK_INSIGHTS` import with TanStack Query fetching from the real `ai_insights` Supabase table. The `AiInsight` type in `lib/mock-data.ts` defines the schema contract.
- D-11: History view is filtered by the active tenant (`/[tenant-slug]/insights`). Super Admin switches tenants via the header TenantSwitcher to see another tenant's insights. No consolidated cross-tenant view in this phase.

### Claude's Discretion
- Exact prompt template for on-demand vs daily analysis (researcher will define based on REQUIREMENTS.md)
- DB schema for `ai_insights` and `anomaly_alerts` tables (planner decides columns based on the `AiInsight` type and anomaly requirements)
- How N8N calls the Claude API (direct via HTTP node or via a Next.js Route Handler as proxy)
- Supabase Realtime channel name and filter configuration
- Exact toast duration and badge clear mechanism (seen when page visited)

### Deferred Ideas (OUT OF SCOPE)
- Cross-tenant consolidated insights view (requires new route or global page)
- Email/push notifications for anomaly alerts (v2 — in-app only for now)
- Manual alert acknowledgment / dismiss workflow
- Insight quality feedback (thumbs up/down rating)
- Per-campaign drill-down from an insight card

None — discussion stayed within phase scope.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Tech stack non-negotiable:** Next.js 15 (App Router) + Supabase + N8N self-hosted + Vercel.
- **AI Provider (Constraint, non-negotiable):** Claude (Anthropic), model `claude-sonnet-4-6`, for campaign analysis. This is satisfied by `@ai-sdk/anthropic` (same model, same underlying API) — see Summary above for why the SDK-package-name guidance is treated as non-binding relative to this Constraint.
- **Budget:** Vercel Hobby tier — design the streaming route to work within Hobby limits (with Fluid Compute, see below).
- **Security:** RLS mandatory, total tenant isolation — `ai_insights`/`anomaly_alerts` RLS must follow the existing `campaign_metrics`/`daily_rollups` pattern (`(SELECT get_user_role())`/`(SELECT get_tenant_id())`, never bare function calls).
- **N8N write strategy (locked in STATE.md):** HTTP Request node + PostgREST REST API + service role key — never the native N8N Supabase node (GitHub issue #17020, confirmed still the pattern used in `n8n-workflows/google-ads-sync.json`).
- **Claude API calls (locked in STATE.md "Key Decisions Locked"):** "Next.js Route Handlers only — streaming enabled, XML-tagged data injection, N8N triggers via webhook." This phase's daily job MUST go N8N → webhook/HTTP call → Next.js Route Handler → Claude, not N8N calling Claude directly.
- **Vercel deployment optimization table (from CLAUDE.md):** `maxDuration = 60` for AI routes as a baseline; Fluid Compute available for up to 300s on Hobby if 60s isn't enough. `vercel.json` currently sets only `"regions": ["gru1"]` — no `functions` block yet, so no per-route `maxDuration` is configured today; this phase must add one.
- **`getClaims()` not `getUser().app_metadata`:** Per the Phase 05 regression (`.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md`), any new Route Handler in this phase that reads `role`/`tenant_id` for non-`super_admin` callers MUST use `supabase.auth.getClaims()`. Since `/api/insights/generate` is `super_admin`-only (AI-03's "accessible only to Super Admin"), this is lower-risk here, but the role check itself should still follow `get_user_role()` RPC, matching `app/api/meta-ads/connect/route.ts`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | Super Admin triggers on-demand analysis; Claude returns type/priority/recommended action/impact within Vercel timeout via streaming | Standard Stack (ai/@ai-sdk/anthropic), Architecture Pattern 1 (streaming + structured tail block), Vercel Fluid Compute section, Code Examples §1 |
| AI-02 | N8N runs scheduled daily analysis at 05:00 UTC after both syncs; results stored to DB | Architecture Pattern 2 (N8N → Route Handler → Claude), Don't Hand-Roll (shared-secret auth), Code Examples §2, `ai_insights` schema |
| AI-03 | AI Insights history page lists all insights (type, priority, action, impact, timestamp), Super-Admin-only | `ai_insights` schema + RLS section, D-10/D-11 wiring notes |
| AI-04 | In-app anomaly alert when ROAS drops >20% in 24h, no refresh/manual trigger | Supabase Realtime section, `anomaly_alerts` schema + RLS + publication migration, Code Examples §3 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version (verified via npm) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^7.0.22` `[VERIFIED: npm registry, 2026-07-10]` | Vercel AI SDK core — `streamText`, `generateText`, `toTextStreamResponse`/`toUIMessageStreamResponse` | Required by CONTEXT.md D-01 (locked decision) |
| `@ai-sdk/anthropic` | `^4.0.12` `[VERIFIED: npm registry, 2026-07-10]` | Anthropic provider for the AI SDK — talks to `claude-sonnet-4-6` over the Messages API | Only way to satisfy D-01's `streamText` requirement while still calling Claude; shares `@ai-sdk/provider@4.0.3` with `ai@7.0.22` (peer-compatible, confirmed via `npm view`) |

### Explicitly NOT installed (deviation flag)

| Library | Status | Why not used here despite CLAUDE.md's Summary Table |
|---------|--------|-------------------------------------------------------|
| `@anthropic-ai/sdk` | Not installed anywhere in repo `[VERIFIED: package.json + grep]` | CONTEXT.md D-01 explicitly requires Vercel AI SDK `streamText`. `@ai-sdk/anthropic` has no dependency on `@anthropic-ai/sdk` (`[VERIFIED: npm view @ai-sdk/anthropic dependencies]` — only `@ai-sdk/provider`/`@ai-sdk/provider-utils`), so both cannot be "the same choice." Recommend surfacing this explicitly as a locked deviation from the original Phase 0 stack research rather than silently overriding either document. |

**Also note (version drift, not this phase's decision but relevant if `@anthropic-ai/sdk` is ever reconsidered):** CLAUDE.md pins `@anthropic-ai/sdk@^0.95.1`; the registry's current version is `0.111.0` `[VERIFIED: npm registry, 2026-07-10]`, which does **not** satisfy `^0.95.1` (caret on a 0.x version only allows patch bumps within `0.95.x`). The pin is stale regardless of which SDK path is chosen.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | `^5.101.0` (already installed) | Fetch `ai_insights` history, replace `MOCK_INSIGHTS` (D-10) | `useAiInsights(tenantSlug)` hook, same pattern as `use-dashboard-data.ts` |
| `@supabase/ssr` / `@supabase/supabase-js` | already installed (`^0.10.3` / `^2.105.4`) | Server Route Handler auth + Realtime client subscription | Already the project standard |
| `zod` (v4, `zod/v4` subpath already used elsewhere) | `^4.4.3` (already installed) | Validate the N8N→Route Handler request body and the parsed structured-insight block before insert | Matches `app/api/meta-ads/connect/route.ts`'s `BodySchema` pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ai` + `@ai-sdk/anthropic` (`streamText`) | Raw `@anthropic-ai/sdk` `client.messages.stream()` + `stream.toReadableStream()` (the pattern in `.planning/research/PITFALLS.md`/`STACK.md`) | Matches CLAUDE.md's literal package pin and is a thinner dependency, but contradicts CONTEXT.md D-01 verbatim ("Use Vercel AI SDK `streamText`"). Rejected for this phase per CONTEXT.md's locked-decision precedence, but functionally equivalent — worth a 1-line note back to the user that this was a real conflict, resolved in favor of the more recent, phase-specific decision. |
| Narrative-text-with-embedded-structured-tail parsing (recommended) | AI SDK `experimental_output` (schema-validated structured output while streaming) | `experimental_output`/structured-output-with-tools is documented as OpenAI-only as of the current AI SDK release `[CITED: ai-sdk.dev structured-data docs via WebSearch, 2026-07-10]` — not usable with the Anthropic provider today. Revisit if AI SDK adds Anthropic support later. |
| `streamText` for the daily N8N-triggered job too | `generateText` (non-streaming) for the daily job | The daily job has no human watching a stream (D-08/D-09 — result goes straight to DB); `generateText` is simpler and gives a single awaited string to parse, no `onFinish` plumbing needed. Recommended for the daily/anomaly route. |

**Installation:**
```bash
npm install ai @ai-sdk/anthropic
```

**Version verification:** Confirmed against npm registry 2026-07-10:
```
npm view ai version           → 7.0.22
npm view @ai-sdk/anthropic version → 4.0.12
npm view @anthropic-ai/sdk version → 0.111.0 (not used this phase, informational)
```

## Architecture Patterns

### Recommended Project Structure

```
app/
├── api/
│   └── insights/
│       ├── generate/
│       │   └── route.ts        # AI-01: on-demand streaming, super_admin only, Node runtime
│       └── daily/
│           └── route.ts        # AI-02/AI-04: N8N-triggered, shared-secret auth, Node runtime
lib/
├── ai/
│   ├── anthropic.ts             # createAnthropic() singleton, shared model id constant
│   ├── insight-prompt.ts        # buildOnDemandPrompt(), buildDailyPrompt() — shared aggregation→prompt logic
│   └── parse-insight-block.ts   # extractStructuredBlock(text) — shared parser for both routes
├── hooks/
│   ├── use-ai-insights.ts       # TanStack Query — replaces MOCK_INSIGHTS (D-10)
│   └── use-anomaly-alerts.ts    # Supabase Realtime subscription + unread count (D-04/D-06)
supabase/migrations/
├── 0021_create_ai_insights.sql
├── 0022_create_anomaly_alerts.sql
n8n-workflows/
└── daily-insights-and-anomaly-detection.json   # D-08: single workflow, both jobs
```

### Pattern 1: Streaming prose + trailing structured block (on-demand, AI-01)

**What:** Ask Claude to stream a natural-language narrative (what the Super Admin sees token-by-token), then, after the narrative, emit one machine-parseable block delimited by a project-standard tag (`<insight_data>...</insight_data>`) containing the type/priority/recommended-action/impact fields as JSON. The frontend renders `textStream` chunks live but strips/ignores anything after the delimiter opens; the backend parses the full accumulated text in `onFinish` and inserts the structured row.

**When to use:** Any Claude call in this phase that needs both a human-readable stream AND a structured DB row from the same generation — i.e., AI-01. Not needed for AI-02 (no stream) — there, ask for the same delimited block directly in a `generateText` call and skip the prose-vs-structure split.

**Why this shape, not `experimental_output`:** `experimental_output`/structured-output-with-tools in the current AI SDK release is OpenAI-only `[CITED: ai-sdk.dev]`. There is no supported way to get schema-validated structured output while streaming Anthropic prose today.

**Example:**
```typescript
// app/api/insights/generate/route.ts
// Source: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text (WebFetch, 2026-07-10) +
// npm-verified ai@7.0.22 / @ai-sdk/anthropic@4.0.12
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractStructuredBlock } from '@/lib/ai/parse-insight-block'
import { buildOnDemandPrompt } from '@/lib/ai/insight-prompt'

export const runtime = 'nodejs'
export const maxDuration = 60 // Fluid Compute allows up to 300s on Hobby; 60 is the expected p95 ceiling for this prompt size

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: role } = await supabase.rpc('get_user_role')
  if (role !== 'super_admin') return new Response('Forbidden', { status: 403 })

  const { tenantId } = await req.json()
  const prompt = await buildOnDemandPrompt(tenantId) // fetches last-30d daily_rollups + campaign_metrics, per D-09 aggregation style

  const service = createServiceClient()

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: prompt.system,
    prompt: prompt.user,
    onFinish: async ({ text }) => {
      const parsed = extractStructuredBlock(text) // strips <insight_data>...</insight_data>, validates with Zod
      if (parsed) {
        await service.from('ai_insights').insert({
          tenant_id: tenantId,
          source: 'on_demand',
          type: parsed.type,
          title: parsed.title,
          summary: text.split('<insight_data>')[0].trim(), // the streamed prose, minus the tail block
          metrics: parsed.metrics,
          recommendations: parsed.recommendations,
          impact: parsed.impact,
        })
      }
    },
  })

  return result.toTextStreamResponse()
}
```

### Pattern 2: N8N → Route Handler → Claude, shared-secret auth (daily job, AI-02/AI-04)

**What:** N8N's HTTP Request node (same node type it already uses for Supabase PostgREST calls) calls a new `POST /api/insights/daily` Route Handler once per eligible tenant (or once with all tenants in the body — see Discretion note below). This route has no Supabase session to check (it's not user-triggered), so auth is a shared secret header, not `getUser()`/`getClaims()`.

**When to use:** Any server-to-server call from N8N into a Next.js Route Handler that needs to keep the Claude API key on Vercel (per CONTEXT.md's "Specific Ideas" note) rather than in N8N env vars.

**Auth pattern (recommended — shared secret header):**
```typescript
// app/api/insights/daily/route.ts
export const runtime = 'nodejs'
export const maxDuration = 60 // no human waiting; keep well under Fluid Compute's 300s ceiling

export async function POST(req: Request) {
  const secret = req.headers.get('x-n8n-secret')
  if (!secret || secret !== process.env.N8N_INSIGHTS_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... proceed with service-role Supabase client, no user session involved
}
```
- Store `N8N_INSIGHTS_SECRET` as a Vercel env var (server-only, no `NEXT_PUBLIC_` prefix) and as an N8N credential/env var (same secret both sides — same trust model already used for the Supabase service role key in N8N, per `.planning/research/STACK.md`'s "Security" note).
- N8N HTTP Request node: `Header Auth` credential type with header name `x-n8n-secret`, mirroring the existing `httpHeaderAuth` credential pattern already in `n8n-workflows/google-ads-sync.json` (there it's named `Supabase Service Role`; this phase adds a second, differently-scoped Header Auth credential, e.g. `N8N Insights Secret`).
- This is a standard pattern for server-to-server webhook auth `[ASSUMED — general REST/webhook security practice, not sourced from a NEXUS-DASH-specific doc]`; no project precedent exists yet for "N8N calls a Next.js Route Handler" (all prior N8N integrations call Supabase PostgREST directly). Flag as new integration surface, not a copy of an existing verified pattern.

**Anomaly detection placement (D-05/D-08):** Per CONTEXT.md, N8N (not Claude) computes the >20% ROAS drop and inserts directly into `anomaly_alerts` via the existing HTTP Request → Supabase PostgREST pattern (same as `campaign_metrics` writes) — this does NOT go through the Route Handler/Claude at all. Only the insight-generation half of the daily job (AI-02) calls the Route Handler; the anomaly-detection half (AI-04) is pure N8N→Supabase, reusing the Phase 2 pattern verbatim. This keeps the "single N8N workflow" (D-08) but with two different downstream writers inside it.

### Pattern 3: Supabase Realtime for anomaly alerts (AI-04)

**What:** Enable Postgres Changes replication on `anomaly_alerts`, subscribe from a client component in the header/layout area, and use the RLS SELECT policy (super_admin-only) to scope what the subscriber receives.

**Required migration step (currently missing anywhere in the repo — `[VERIFIED: grep across supabase/migrations, no `supabase_realtime` reference found]`):**
```sql
-- supabase/migrations/0022_create_anomaly_alerts.sql (excerpt)
ALTER PUBLICATION supabase_realtime ADD TABLE public.anomaly_alerts;
```
`[CITED: supabase.com/docs/guides/realtime/postgres-changes, via WebSearch 2026-07-10]` — "Postgres Changes works out of the box for tables in the public schema" once added to the `supabase_realtime` publication; toggling this via SQL in a migration (rather than only the Dashboard UI) is the reproducible, git-tracked way to do it, consistent with this project's all-schema-via-migrations convention.

**Client subscription (`lib/hooks/use-anomaly-alerts.ts`):**
```typescript
// Source: pattern derived from Supabase Realtime docs (WebSearch) + project's existing
// lib/supabase/client.ts browser client singleton
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAnomalyAlerts(tenantId: string) {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`anomaly-alerts-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'anomaly_alerts', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          setUnread((n) => n + 1)
          // toast trigger goes here (D-06)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId])
  return unread
}
```
**Important caveat — RLS on Realtime is respected for the caller's session, but the `postgres_changes` `filter` clause is NOT a security boundary by itself.** The RLS SELECT policy on `anomaly_alerts` (super_admin-only, matching `campaign_metrics_super_admin_all`'s pattern) is what actually prevents a non-super_admin from receiving rows; the client-side `filter` is a convenience/performance filter, not access control. This must be verified live during implementation (Realtime + RLS interaction has had documented rough edges historically) — flagged LOW confidence pending a live test in this project's Supabase instance.

### Anti-Patterns to Avoid

- **Calling Claude directly from N8N (bypassing the Route Handler):** Violates the locked STATE.md decision ("Claude API calls: Next.js Route Handlers only") and would put `ANTHROPIC_API_KEY` in N8N env vars instead of Vercel's.
- **Using the native N8N Supabase node for the `anomaly_alerts` insert:** Same GitHub #17020 403 bug documented for `campaign_metrics`/`sync_jobs` writes — use the HTTP Request + PostgREST pattern already established.
- **Trusting the Realtime `filter` param as the only tenant-scoping mechanism:** must be backed by an RLS SELECT policy, not just the client-side subscription filter.
- **Re-deriving `tenantId` from a client-supplied value in the daily/N8N route without validating against actual `ad_accounts` rows:** the route should look up eligible tenants server-side (D-07: "tenants with at least one `ad_accounts` row"), not trust an arbitrary `tenantId` in the N8N payload for which tenants to process.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Token-by-token streaming HTTP response from a Route Handler | Manual `ReadableStream`/SSE plumbing around a raw `fetch()` to the Anthropic API | `ai`'s `streamText(...).toTextStreamResponse()` | Handles headers, backpressure, and chunk framing; this is exactly what D-01 asks for and what the library exists to do |
| Real-time push to the browser | Polling `ai_insights`/`anomaly_alerts` on an interval | Supabase Realtime `postgres_changes` subscription | D-04 explicitly rejects polling; Realtime is already a decided-stack feature (`Database | Supabase (... + Realtime)` in CLAUDE.md's stack table) that has simply never been wired up yet in this codebase |
| Server-to-server auth for the N8N→Route Handler call | Rolling a custom HMAC/signature scheme | A single shared-secret header compared with a constant-time-safe equality (or at minimum strict `===` since this is a low-stakes internal trigger, not a payment webhook) | Simpler is appropriate here — this is an internal VPS-to-Vercel call, not a public webhook receiving third-party payloads |
| Extracting structured fields from streamed prose | Regex-scraping the entire response ad hoc per call site | One shared `lib/ai/parse-insight-block.ts` helper with a Zod schema, used by both the on-demand and daily routes | Avoids two slightly-different parsers drifting apart; keeps the `AiInsight`-shaped contract (D-10) in one place |

**Key insight:** Nearly everything this phase needs (streaming, structured extraction, realtime push, tenant-scoped writes) already exists as either a library feature or an established project pattern (`campaign_metrics`-style RLS, `google-ads-sync.json`-style N8N HTTP node auth) — the actual new surface area is small: the AI SDK dependency, the tag-delimited parser, the Realtime publication toggle, and the N8N→Vercel shared secret.

## Common Pitfalls

### Pitfall 1: Assuming `streamText` bypasses the Vercel function timeout entirely
**What goes wrong:** Teams sometimes read "use streaming to avoid timeouts" and assume the serverless function can run indefinitely once headers are sent.
**Why it happens:** Streaming does make the connection feel responsive (progressive output), but the underlying function invocation is still subject to `maxDuration`. If the model takes longer than the configured duration to finish generating, the function is still killed mid-stream.
**How to avoid:** Set `export const maxDuration = 60` (or higher) explicitly, and enable Fluid Compute in the Vercel project settings so Hobby gets the 300s ceiling `[CITED: vercel.com/docs/fluid-compute + vercel.com/docs/functions/configuring-functions/duration, via WebSearch 2026-07-10]` — do not rely on streaming alone as a timeout escape hatch.
**Warning signs:** Stream cuts off mid-sentence for long analyses; correlates with p95 duration approaching the configured `maxDuration`.

### Pitfall 2: Forgetting to add the new table to the `supabase_realtime` publication
**What goes wrong:** RLS policies and the table exist, the frontend subscribes, but no events ever arrive.
**Why it happens:** Postgres Changes replication is opt-in per table via `ALTER PUBLICATION supabase_realtime ADD TABLE ...` (or the Dashboard's Replication toggle) — a plain `CREATE TABLE` + RLS setup does not enable Realtime by itself `[CITED: supabase.com/docs/guides/realtime/postgres-changes]`.
**How to avoid:** Include the `ALTER PUBLICATION` statement in the `anomaly_alerts` migration itself, not as a manual Dashboard step, so it survives environment resets/staging rebuilds (this project already reuses one Supabase project for staging+prod per STATE.md, so this must be idempotent/safe to re-run).
**Warning signs:** No realtime events despite successful inserts confirmed via direct query.

### Pitfall 3: Treating the recommended-action/impact fields as reliably present in every generation
**What goes wrong:** The tag-delimited JSON block Claude is asked to emit is not schema-enforced the way tool-calling structured output is; a malformed or missing block will make `extractStructuredBlock` return `null`, silently dropping an insight.
**Why it happens:** `experimental_output` (which would guarantee schema validity) is OpenAI-only today; the delimited-tag approach is inherently best-effort prompting, not a hard API contract.
**How to avoid:** On `onFinish`, if `extractStructuredBlock` returns `null`, still persist a row with a fallback `type`/`impact` (e.g., `type: 'optimization'`, `impact: 'medium'`) and the raw text as `summary`, rather than dropping the insight entirely — and log/monitor parse failures. This should be a decision surfaced to the planner (retry-once vs. fallback-persist) since CONTEXT.md's Discretion section leaves prompt template details open but does not cover parse-failure handling explicitly.
**Warning signs:** `ai_insights` rows disappearing between "stream completed" (UI shows it) and "history list" (D-03 says it should appear automatically) — a parse failure would make D-03 silently fail for that generation.

### Pitfall 4: N8N daily job re-running Claude/anomaly logic per-campaign instead of per-tenant aggregate
**What goes wrong:** Token usage and Vercel function count balloon if the daily job calls the Route Handler once per campaign instead of once per tenant with pre-aggregated JSON.
**Why it happens:** D-09 says "concise aggregated JSON... per channel and per campaign," which could be misread as "one Claude call per campaign."
**How to avoid:** One Claude call per tenant, with the aggregated JSON (all channels + all campaigns for that tenant, last 30 days) as a single prompt payload — matches D-09's intent ("keeps token usage low," implying one call per tenant, not N calls).
**Warning signs:** Daily job N8N execution count or Vercel invocation count scaling with campaign count instead of tenant count (3 tenants max in v1, per CLAUDE.md's Constraints).

## Code Examples

### 1. Structured-block parser (shared by both routes)
```typescript
// lib/ai/parse-insight-block.ts
import { z } from 'zod/v4'

const InsightBlockSchema = z.object({
  type: z.enum(['optimization', 'alert', 'opportunity']),
  title: z.string().min(1),
  impact: z.enum(['high', 'medium', 'low']),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), delta: z.string().optional() })),
  recommendations: z.array(z.string()).min(1),
})

export function extractStructuredBlock(fullText: string) {
  const match = fullText.match(/<insight_data>([\s\S]*?)<\/insight_data>/)
  if (!match) return null
  try {
    const json = JSON.parse(match[1])
    return InsightBlockSchema.parse(json)
  } catch {
    return null
  }
}
```
This mirrors the `AiInsight` type in `lib/mock-data.ts` (D-10's schema contract) field-for-field.

### 2. N8N → Route Handler request shape (for the workflow's HTTP Request node)
```
Method: POST
URL: https://nexus-dash-<...>.vercel.app/api/insights/daily
Headers:
  x-n8n-secret: {{ $credentials.n8nInsightsSecret }}
  Content-Type: application/json
Body: {} // route derives eligible tenants server-side per D-07, not from N8N payload
```

### 3. `ai_insights` / `anomaly_alerts` schema (proposed, following the `campaign_metrics`/`daily_rollups` conventions exactly)
```sql
-- supabase/migrations/0021_create_ai_insights.sql
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('on_demand', 'daily')),
  type            TEXT NOT NULL CHECK (type IN ('optimization', 'alert', 'opportunity')),
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  metrics         JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  impact          TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_created ON public.ai_insights(tenant_id, created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- AI-03: "accessible only to Super Admin" — no tenant_admin/agency SELECT policy at all.
-- Confirms REQUIREMENTS.md wording literally: only super_admin_all, no tenant_select counterpart
-- (unlike campaign_metrics/daily_rollups/ad_accounts, which all grant tenant SELECT).
CREATE POLICY ai_insights_super_admin_all ON public.ai_insights
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

REVOKE ALL ON public.ai_insights FROM anon;

-- supabase/migrations/0022_create_anomaly_alerts.sql
CREATE TABLE IF NOT EXISTS public.anomaly_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL,
  campaign_name   TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('google_ads', 'meta_ads')),
  metric          TEXT NOT NULL DEFAULT 'roas',
  drop_pct        NUMERIC(6,2) NOT NULL,
  window_hours    INTEGER NOT NULL DEFAULT 24,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_tenant_created ON public.anomaly_alerts(tenant_id, created_at DESC);

ALTER TABLE public.anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY anomaly_alerts_super_admin_all ON public.anomaly_alerts
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

REVOKE ALL ON public.anomaly_alerts FROM anon;

ALTER PUBLICATION supabase_realtime ADD TABLE public.anomaly_alerts;
```
**Note on the RLS decision above:** CONTEXT.md D-11 says "no consolidated cross-tenant view," which is about the UI only showing one tenant at a time — it does NOT say tenant_admin/agency should be blocked entirely. But REQUIREMENTS.md's AI-03 literally says "accessible only to Super Admin," and the Phase 5 `agency`/`tenant_admin` roles have zero mention in this phase's CONTEXT.md. **Recommendation: follow REQUIREMENTS.md literally — super_admin-only, no tenant SELECT policy at all** — this is the more specific, testable requirement wording. If a `tenant_admin` needs to see their own tenant's insights later, that is a new requirement, not an oversight in this schema. Flagged as an assumption for planner/discuss-phase confirmation (see Assumptions Log A2).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Raw `fetch()` to `api.anthropic.com/v1/messages`, non-streaming (current `app/api/leads/chat/route.ts`) | `ai`/`@ai-sdk/anthropic` `streamText`/`generateText` | This phase, per CONTEXT.md D-01 | This phase introduces the SDK the project didn't have before; it does not extend an existing pattern — there was nothing prior to build on for streaming |
| `@anthropic-ai/sdk@^0.95.1` (CLAUDE.md's pinned Summary Table version) | `@anthropic-ai/sdk@0.111.0` on the registry (not used this phase, informational) | Ongoing releases through 2026-07-10 | If a future phase does adopt the raw SDK, the pin needs updating regardless |

**Deprecated/outdated:**
- The `.planning/research/STACK.md` Claude-integration code sample (`client.messages.stream()` + `stream.toReadableStream()`) is technically still valid for `@anthropic-ai/sdk`, but is superseded for this phase by CONTEXT.md D-01's explicit AI SDK requirement.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Shared-secret header (`x-n8n-secret`) is an acceptable auth pattern for the N8N→Route Handler call, with no existing project precedent to verify against | Architecture Pattern 2 | Low-medium — if the user wants mTLS/IP-allowlisting instead, the route's auth check needs rework, but the shape of everything else (route location, `generateText` call, DB writes) is unaffected |
| A2 | `ai_insights`/`anomaly_alerts` should have NO tenant_admin/agency SELECT policy at all (super_admin-only, per REQUIREMENTS.md AI-03's literal wording), rather than a `tenant_select` policy like `campaign_metrics`/`daily_rollups` have | Code Examples §3, Summary | Medium — if a `tenant_admin` unexpectedly needs their own insights visible later, this requires a new migration + RLS policy + route/UI changes, not just a config flip |
| A3 | Realtime `postgres_changes` correctly enforces the `anomaly_alerts_super_admin_all` RLS policy for subscription delivery (not just for direct queries) | Pattern 3 caveat | Medium-high — if RLS is not fully enforced for the Realtime replication path in this Supabase project/version, a non-super_admin could receive anomaly alert payloads over the websocket even without table SELECT access; must be live-tested before relying on it as the sole access control for AI-04 |
| A4 | One Claude call per tenant (not per campaign) is the correct reading of D-09's "concise aggregated JSON... per channel and per campaign" | Pitfall 4 | Low — if wrong, it's a token-cost/scale issue, not a correctness break, and cheap to fix (batch size = 3 tenants max in v1 either way) |
| A5 | Parse-failure fallback behavior (persist with defaulted `type`/`impact` vs. drop vs. retry) is not specified by CONTEXT.md and needs a planner/user decision | Pitfall 3 | Low-medium — affects whether D-03's "insight appears automatically" holds up under a malformed generation; currently undefined behavior |

## Open Questions (RESOLVED)

1. **Should the daily N8N job call the Route Handler once per tenant (3 separate HTTP calls) or once total with all eligible tenants in a loop inside the route?**
   - **RESOLVED (Plan 06):** Plan 06 implements the per-tenant `splitInBatches` loop — N8N calls the Route Handler once per eligible tenant (`google-ads-sync.json` convention), keeping each Vercel invocation small. Recommendation adopted.
   - What we know: D-07 defines eligibility (tenants with ≥1 `ad_accounts` row); D-08 wants a single N8N workflow.
   - What's unclear: whether "single workflow" means N8N's `splitInBatches`/loop node calls the route N times (mirroring the existing `google-ads-sync.json` per-tenant loop pattern), or the route itself loops over all eligible tenants in one invocation.
   - Recommendation: Follow the existing `google-ads-sync.json` convention — N8N loops (`splitInBatches`) and calls the Route Handler once per tenant, keeping each Vercel invocation small and within `maxDuration`. Confirm with planner.

2. **Toast/badge library — does this project have a toast primitive installed yet?**
   - **RESOLVED (Plan 05):** Plan 05 installs shadcn's official Sonner-based toast via `npx shadcn@latest add sonner` and fires anomaly alerts with `toast.custom()`. Recommendation adopted.
   - What we know: `deferred-items.md`/STATE.md mention "no sonner" was a deliberate choice in Phase 03.1 (native `<select>`, no toast dependency added for that feature).
   - What's unclear: whether D-06's "toast immediately" implies installing a toast library now (e.g., shadcn's `sonner`-based `Toast`/`Toaster` component) or building a minimal custom one.
   - Recommendation: shadcn/ui's official Toast/Sonner component is the path of least friction (same CLI-based, zero-new-dependency-family approach as every other UI primitive in this project) — install via `npx shadcn@latest add sonner` when this phase is planned. Not verified against the current shadcn registry in this research pass — planner should confirm the component still exists under that name at plan time.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ANTHROPIC_API_KEY` | Both Claude routes | ✓ (present in `.env.local`, confirmed via grep) | — | Must still be added to Vercel Dashboard (Production+Preview+Development) per STATE.md's deferred item — blocks production deploy, not local dev |
| `ai` / `@ai-sdk/anthropic` npm packages | On-demand + daily routes | ✗ (not yet installed) | Latest verified: `ai@7.0.22`, `@ai-sdk/anthropic@4.0.12` | None needed — straightforward `npm install` |
| Supabase Realtime (project-level feature) | AI-04 | Assumed ✓ — Realtime is a core Supabase Cloud feature, no separate provisioning historically required for this project's plan tier | — | If disabled at the project level, would need Supabase Dashboard toggle — not expected to be an issue but not explicitly confirmed via MCP for this specific project (`rvkkvjitfddtbdpkupok`) in this research pass |
| N8N VPS (`evo.wrdigitalgroup.com.br`) | AI-02/AI-04 workflow | ✓ per STATE.md ("Queue Mode confirmed") | Version unverified (STATE.md flags this as a pre-existing open blocker unrelated to this phase) | N/A — pre-existing infra, out of scope to re-verify here |

**Missing dependencies with no fallback:**
- None blocking — `ANTHROPIC_API_KEY` Vercel Dashboard registration is a deploy-time task, not a code/plan blocker.

**Missing dependencies with fallback:**
- `ai`/`@ai-sdk/anthropic` — simple `npm install`, no fallback needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` (already configured, `npm test` = `vitest run`) |
| Config file | none dedicated found (likely inline/default) — see Wave 0 gap below |
| Quick run command | `npx vitest run tests/unit/<file>.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| AI-01 | `extractStructuredBlock` correctly parses a well-formed `<insight_data>` block and returns null on malformed input | unit | `npx vitest run tests/unit/parse-insight-block.test.ts` | ❌ Wave 0 |
| AI-01 | `/api/insights/generate` rejects non-super_admin callers (403) | unit/integration (mock-based, mirrors `tests/unit/leads-status-route.test.ts`) | `npx vitest run tests/unit/insights-generate-route.test.ts` | ❌ Wave 0 |
| AI-02 | `/api/insights/daily` rejects requests without the correct `x-n8n-secret` header | unit | `npx vitest run tests/unit/insights-daily-route.test.ts` | ❌ Wave 0 |
| AI-03 | `ai_insights` RLS: super_admin can SELECT, tenant_admin cannot (mirrors `tests/integration/sync-jobs-rls.test.ts` pattern, skip-if-no-env) | integration | `npx vitest run tests/integration/ai-insights-rls.test.ts` | ❌ Wave 0 |
| AI-04 | `anomaly_alerts` RLS + `supabase_realtime` publication membership (schema-level check, mirrors `tests/unit/daily-rollups-schema.test.ts`) | integration | `npx vitest run tests/unit/anomaly-alerts-schema.test.ts` | ❌ Wave 0 |
| AI-04 | ROAS drop >20%/24h detection logic (if implemented as a Postgres function rather than purely in N8N) | unit | `npx vitest run tests/unit/roas-anomaly-detection.test.ts` | ❌ Wave 0 (pending planner's choice of where this logic lives — N8N Function node vs. SQL function) |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test files>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/parse-insight-block.test.ts` — covers AI-01 structured-block parsing/fallback behavior
- [ ] `tests/unit/insights-generate-route.test.ts` — covers AI-01 auth/role gate (mock Supabase client, same shape as `tests/unit/leads-status-route.test.ts`)
- [ ] `tests/unit/insights-daily-route.test.ts` — covers AI-02 shared-secret auth gate
- [ ] `tests/integration/ai-insights-rls.test.ts` — covers AI-03 RLS (skip-if-no-env, same pattern as `tests/integration/sync-jobs-rls.test.ts`)
- [ ] `tests/unit/anomaly-alerts-schema.test.ts` — covers AI-04 schema constraints + publication membership
- No framework install needed — Vitest is already configured and used across 18 existing test files.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes (indirect) | On-demand route: existing Supabase session (`getUser()` + `get_user_role()` RPC), same as `app/api/meta-ads/connect/route.ts` |
| V3 Session Management | No | No new session state introduced |
| V4 Access Control | Yes | `ai_insights`/`anomaly_alerts` RLS (super_admin-only, no tenant policy — see A2); daily route's shared-secret check is a form of service-to-service access control, not user-facing |
| V5 Input Validation | Yes | Zod validation of: (a) N8N→Route Handler request body, (b) the parsed `<insight_data>` JSON block before DB insert — never trust Claude's output shape without validation |
| V6 Cryptography | No new requirement | Shared secret is a static comparison value, not a cryptographic signature; if the user wants HMAC-signed webhooks instead, that would introduce a V6 concern — currently out of scope per CONTEXT.md's discretion list |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Prompt injection via campaign/metric data reaching Claude (e.g., a malicious campaign name containing instruction-like text) | Tampering | XML-tag delimited data injection — already a locked project convention (STATE.md: "XML-tagged data injection") — wrap all aggregated metrics/campaign names in a clearly delimited `<campaign_data>` block and instruct Claude to treat it as data, not instructions, per `.planning/research/PITFALLS.md`'s existing guidance |
| N8N→Route Handler call spoofed by an attacker who discovers the endpoint URL | Spoofing | Shared-secret header (`x-n8n-secret`), constant-time-safe comparison recommended even though this is a low-stakes internal call |
| Non-super_admin reading another tenant's `ai_insights`/`anomaly_alerts` via a missed RLS policy or a service-role leak in a client-callable path | Elevation of Privilege | RLS `super_admin_all` policy + `REVOKE ALL ... FROM anon` (matches every other table in this project); never expose the service-role client to `'use client'` code (same discipline as `lib/supabase/service.ts`'s `import 'server-only'` guard) |
| Realtime channel delivering rows a subscriber shouldn't see (if RLS-for-Realtime has gaps) | Information Disclosure | See Assumption A3 — must be live-verified, not just assumed from RLS existing on the table |

## Sources

### Primary (HIGH confidence)
- `npm view ai version` / `npm view @ai-sdk/anthropic version` / `npm view @anthropic-ai/sdk version` / `npm view @ai-sdk/anthropic dependencies` / `npm view ai dependencies` — direct registry queries, 2026-07-10
- Local codebase: `package.json`, `app/api/leads/chat/route.ts`, `app/api/meta-ads/connect/route.ts`, `lib/supabase/{client,server,service}.ts`, `supabase/migrations/0001–0020`, `n8n-workflows/google-ads-sync.json`, `.planning/STATE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- Vercel Fluid Compute / maxDuration behavior — WebSearch, cross-referenced against `vercel.com/docs/fluid-compute` and `vercel.com/docs/functions/configuring-functions/duration` (both official)
- Supabase Realtime Postgres Changes / publication setup — WebSearch, cross-referenced against `supabase.com/docs/guides/realtime/postgres-changes`
- AI SDK `streamText`/`onFinish`/response-method shapes — WebFetch of `ai-sdk.dev/docs/reference/ai-sdk-core/stream-text`
- `experimental_output`/structured-output-with-tools being OpenAI-only — WebSearch summary of `ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`; not independently re-confirmed via a second source in this pass — treat as MEDIUM, re-verify at plan/implementation time if the structured-output approach becomes a blocker

### Tertiary (LOW confidence)
- Shared-secret header as "the" pattern for N8N→Route Handler auth — no project precedent exists to verify against; this is general security practice reasoning, not a sourced claim (see Assumption A1)
- RLS enforcement over the Realtime `postgres_changes` delivery path for this specific Supabase project — not live-tested in this research pass (see Assumption A3)

## Metadata

**Confidence breakdown:**
- Standard stack (ai/@ai-sdk/anthropic versions, dependency graph): HIGH — verified directly via npm registry
- Architecture (streaming+structured-tail pattern, N8N shared-secret, Realtime wiring): MEDIUM — patterns are sound and cross-referenced against official docs, but two pieces (Realtime+RLS interaction, N8N→Vercel auth) have no prior precedent in this specific codebase to verify against
- Pitfalls: HIGH for Vercel timeout/Realtime-publication pitfalls (both directly sourced from current official docs); MEDIUM for the parse-failure-fallback pitfall (a reasoned prediction, not observed)

**Research date:** 2026-07-10
**Valid until:** 30 days (stable domain — AI SDK and Vercel platform features move fast; re-verify `ai`/`@ai-sdk/anthropic` versions and the `experimental_output` OpenAI-only limitation if planning is delayed beyond that window)
