---
phase: 04-ai-insights
reviewed: 2026-07-11T14:21:21Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/[tenant-slug]/dashboard/page.tsx
  - app/[tenant-slug]/insights/page.tsx
  - app/[tenant-slug]/layout.tsx
  - app/api/insights/daily/route.ts
  - app/api/insights/generate/route.ts
  - components/dashboard/ai-shortcut-card.tsx
  - components/insights/anomaly-listener.tsx
  - components/insights/streaming-insight-card.tsx
  - components/layout/sidebar-nav.tsx
  - components/ui/sonner.tsx
  - lib/ai/anthropic.ts
  - lib/ai/insight-prompt.ts
  - lib/ai/parse-insight-block.ts
  - lib/hooks/use-ai-insights.ts
  - lib/hooks/use-anomaly-alerts.tsx
  - lib/stores/anomaly-alerts.ts
  - n8n-workflows/daily-insights-and-anomaly-detection.json
  - package.json
  - supabase/migrations/0021_create_ai_insights.sql
  - supabase/migrations/0022_create_anomaly_alerts.sql
  - tests/integration/ai-insights-rls.test.ts
  - tests/unit/anomaly-alerts-schema.test.ts
  - tests/unit/insights-daily-route.test.ts
  - tests/unit/insights-generate-route.test.ts
  - tests/unit/parse-insight-block.test.ts
  - types/database.types.ts
  - vercel.json
findings:
  critical: 1
  warning: 5
  info: 1
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-11T14:21:21Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed Phase 4's AI Insights feature: the Vercel AI SDK streaming/on-demand route, the N8N-triggered daily route, structured-block parsing, the two new super_admin-only tables (`ai_insights`, `anomaly_alerts`), and the Realtime anomaly-alert toast pipeline.

The RLS policies on both new tables are correctly scoped to `super_admin` only, with `REVOKE ALL FROM anon` and (for `anomaly_alerts`) the mandatory `ALTER PUBLICATION supabase_realtime ADD TABLE` — all matching the AI-03/AI-04 requirements and verified by the integration test suites. The shared-secret gate on `/api/insights/daily` correctly rejects missing/incorrect secrets and validates `ad_accounts` eligibility server-side rather than trusting the payload. `extractStructuredBlock`'s fallback-to-defaults policy (never drop an insight on malformed AI output) is implemented correctly and is well covered by unit tests.

The most significant issue is a genuine XSS vector: `InsightCard` renders an AI-generated metric value via `dangerouslySetInnerHTML` with no sanitization. Because that value is Zod-validated only as `z.string()` (any string content is accepted) and ultimately originates from a Claude completion that itself embeds campaign names/data supplied by the tenant's ad accounts, this is a stored-XSS path that should be fixed before shipping. Several warnings around silent insert-error swallowing, a page-level authorization gap for the AI Insights UI (accessible in the nav/dashboard shortcut to non-super_admin roles despite AI-03's "super_admin only" wording, even though RLS/route auth blocks actual data access), a non-constant-time secret comparison, and a missing cleanup on the client streaming loop round out the findings.

## Critical Issues

### CR-01: XSS via `dangerouslySetInnerHTML` rendering AI-generated metric value

**File:** `app/[tenant-slug]/insights/page.tsx:117`
**Issue:** `InsightCard` renders each metric's `value` field with `dangerouslySetInnerHTML`:
```tsx
<span dangerouslySetInnerHTML={{ __html: m.value }} />
```
`m.value` comes from `insight.metrics`, which is populated from the `ai_insights.metrics` JSONB column, which in turn is populated straight from Claude's `<insight_data>` JSON block (`lib/ai/parse-insight-block.ts`). The Zod schema only requires `value: z.string()` — any string is accepted, including HTML/script markup. Because the prompt embeds tenant-controlled ad-platform data (campaign names) inside `<campaign_data>`, and the system prompt's defense against prompt injection is instructional only (not enforced), a maliciously-named campaign or a model hallucination could cause `value` to contain a `<script>`/`<img onerror>` payload that executes in the super_admin's browser when the insight is rendered — a stored XSS reachable by anyone who can name a campaign in the connected Google/Meta Ads account.

There is no functional reason for this field to use raw HTML — every other field on `AiInsight` (`title`, `summary`, `rec`, `m.delta`) is rendered as plain JSX text and is therefore already safe.
**Fix:**
```tsx
<span>{m.value}</span>
```
If any lightweight formatting (e.g. superscript "x" in "4.9x") is genuinely desired, sanitize with a strict allowlist library (e.g. `dompurify` with an allowlist of `sup`/`sub` only) rather than rendering raw model output.

## Warnings

### WR-01: Insert failures on `ai_insights` are silently swallowed (daily route)

**File:** `app/api/insights/daily/route.ts:48-57`
**Issue:** `await service.from('ai_insights').insert({...})` discards the returned `{ error }`. If the insert fails (RLS misconfiguration, network blip, constraint violation), the route still returns `{ ok: true }` with a 200 status to N8N, so the failure is invisible to both the daily-insights audit trail and any N8N error-workflow retry logic.
**Fix:**
```ts
const { error: insertError } = await service.from('ai_insights').insert({ ... })
if (insertError) {
  console.error('[insights/daily] insert failed', insertError)
  return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })
}
```

### WR-02: Insert failures on `ai_insights` are silently swallowed (generate route `onFinish`)

**File:** `app/api/insights/generate/route.ts:47-61`
**Issue:** Same pattern as WR-01 — the `onFinish` callback's `await service.from('ai_insights').insert({...})` never checks the returned error. Since the response has already been streamed to the client by the time `onFinish` runs, a failed insert here means the analysis is lost with zero server-side visibility, directly undermining the "D-03 must always hold: persist a fallback row rather than drop" invariant documented in the comment above it.
**Fix:** Capture and log the error (and consider surfacing it via `streamText`'s `onError` callback or an application-level alert/metric), e.g.:
```ts
onFinish: async ({ text }) => {
  ...
  const { error } = await service.from('ai_insights').insert({ ... })
  if (error) console.error('[insights/generate] onFinish insert failed', error)
},
```

### WR-03: AI Insights UI reachable by non-super_admin roles despite AI-03's "super_admin only" scope

**Files:** `components/layout/sidebar-nav.tsx:51`, `app/[tenant-slug]/dashboard/page.tsx:312`, `app/[tenant-slug]/insights/page.tsx` (no role guard)
**Issue:** AI-03 requires the AI Insights feature to be "accessible only to Super Admin." RLS on `ai_insights` and the role check on `POST /api/insights/generate` (403 for non-super_admin) do correctly block actual data access/mutation — but the UI surfaces are not gated to match:
- `sidebar-nav.tsx:51` only strips the `insights` nav item for `role === 'agency'`; `tenant_admin` and `viewer` still see and can click the "AI Insights" link.
- `dashboard/page.tsx:312` renders `<AiShortcutCard tenantSlug={tenantSlug} />` unconditionally, regardless of role.
- `insights/page.tsx` has no client-side or server-side role check/redirect; a `tenant_admin`/`viewer` who navigates to `/{tenant-slug}/insights` sees a working-looking page (empty state, since RLS blocks reads) and a "Analisar agora" button that, when clicked, generates a confusing generic failure ("Falha na análise") because the API 403s.
This is not a data-exposure bug (defense in depth via RLS + route auth holds), but it is an authorization/UX design gap: the feature's visibility does not match its documented access scope, and it silently breaks for roles that should never see the entry points at all.
**Fix:** Pass `role` down from `TenantLayout` (which already resolves it via `getClaims()`) to `SidebarNav` and to the dashboard page (or fetch role client-side once and gate on it), then:
- Filter the `insights` nav item for any `role !== 'super_admin'`, not just `agency`.
- Conditionally render `AiShortcutCard` only when `role === 'super_admin'`.
- Add an early-return/redirect in `insights/page.tsx` for non-super_admin roles, mirroring the `role === 'super_admin'` gate already used for `AnomalyListener` in `layout.tsx:102`.

### WR-04: Shared-secret comparison is not constant-time

**File:** `app/api/insights/daily/route.ts:15`
**Issue:** `secret !== process.env.N8N_INSIGHTS_SECRET` is a standard `!==` string comparison, which short-circuits on the first differing byte. Over many requests this is a (low-severity but real) timing side-channel that could help an attacker incrementally guess `N8N_INSIGHTS_SECRET`.
**Fix:** Use a constant-time comparison, e.g.:
```ts
import { timingSafeEqual } from 'node:crypto'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
...
const secret = req.headers.get('x-n8n-secret')
const expected = process.env.N8N_INSIGHTS_SECRET
if (!secret || !expected || !safeCompare(secret, expected)) {
  return new Response('Unauthorized', { status: 401 })
}
```

### WR-05: Streaming fetch loop has no cleanup on unmount

**File:** `app/[tenant-slug]/insights/page.tsx:162-202`
**Issue:** `handleGenerate` reads the response body in a `while (true)` loop and, on completion, schedules a `setTimeout(async () => { await refetch(); setStreamState('idle'); setStreamedText('') }, 600)`. Neither the reader loop nor the timeout is tied to component lifecycle: if the user navigates away from `/{tenant-slug}/insights` while a stream is in flight (e.g. via the sidebar or browser back button) the loop keeps running and calls `setStreamedText`/`setStreamState` after unmount, and the pending `refetch()` fires against a query that may no longer be observed. This produces React "set state on unmounted component" warnings and wasted work, and — combined with the auto-trigger `useEffect` on mount (`searchParams.get('trigger') === '1'`) — means a quick navigate-away-and-back could leave two overlapping streams racing to update the same state.
**Fix:** Track mount state / use an `AbortController` wired to `res.body`'s reader and a cleanup function:
```ts
useEffect(() => {
  return () => { abortControllerRef.current?.abort() }
}, [])
```
and guard each `setStreamState`/`setStreamedText`/`refetch()` call with an `isMounted` check or by aborting the fetch (`fetch(url, { signal })`) in the returned cleanup.

## Info

### IN-01: `AiInsight` type sourced from a mock-data module

**File:** `lib/hooks/use-ai-insights.ts:5`
**Issue:** The production data-fetching hook imports its core type (`AiInsight`) from `@/lib/mock-data`, coupling real Supabase-backed data to what reads as a fixtures/mock module. This works today but is a confusing convention for future maintainers and risks the type silently drifting from the actual `ai_insights` table shape (`types/database.types.ts`) since there's no shared source of truth between them.
**Fix:** Extract `AiInsight` (and the related `metrics`/`recommendations` item shapes) into a dedicated `lib/ai/types.ts` (or `types/insights.ts`), and have both `lib/mock-data.ts` and `lib/hooks/use-ai-insights.ts` import from it.

---

_Reviewed: 2026-07-11T14:21:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
