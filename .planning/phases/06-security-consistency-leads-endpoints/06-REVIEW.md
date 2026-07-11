---
phase: 06-security-consistency-leads-endpoints
reviewed: 2026-07-11T17:41:15Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/[tenant-slug]/leads/agente/page.tsx
  - app/api/leads/chat/route.ts
  - app/api/leads/route.ts
  - lib/rate-limit.ts
  - tests/unit/leads-chat-route.test.ts
  - tests/unit/leads-get-route.test.ts
  - tests/unit/rate-limit.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-11T17:41:15Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the hardening changes to `GET /api/leads`, `POST /api/leads/chat`, the new `lib/rate-limit.ts` sliding-window limiter, the `agente/page.tsx` client, and the three new/updated unit test files. The core security work this phase set out to do — role gate + `getClaims()`-based tenant/agency scope check mirrored from `PATCH /api/leads/[id]/status`, per-user rate limiting on the chat endpoint, and migration off raw `fetch` to `streamText`/`insightModel` — is implemented correctly and is well covered by tests (401/403/400/200/429 paths all exercised for both routes, plus isolated rate-limiter unit tests). No SQL/command injection, hardcoded secrets, XSS, or authorization-bypass issues were found in the reviewed diff.

Two real gaps remain that touch this phase's stated goal of *consistency* across the leads endpoints and *AI routes* elsewhere in the codebase:

1. `POST /api/leads/chat` is a `streamText` AI route but — unlike its own migration source, `app/api/insights/generate/route.ts` — it does not set `export const maxDuration = 60`, nor is it registered in `vercel.json`'s `functions` block. Every other AI streaming route in this codebase has both. This is a genuine, unaddressed drift (not called out in `06-RESEARCH.md`, `06-CONTEXT.md`, or any phase-6 plan/summary file).
2. The chat request body's `system` and `messages[].content` fields have a `.min(1)` but no upper bound, and there is no rate limiting at all on `GET /api/leads`'s Sheets API reads — worth a deliberate look even though the latter may be an intentional scope choice (D-03 explicitly targets the *costed* Anthropic key, not the Sheets read path).

None of the findings below are blocking-severity (no Critical items), but WR-01 and WR-02 are worth fixing before this phase is considered fully closed, since they sit squarely inside "security & consistency" as the phase's own stated purpose.

## Warnings

### WR-01: `POST /api/leads/chat` is missing `maxDuration`, unlike its own reference pattern

**File:** `app/api/leads/chat/route.ts:1-9`
**Issue:** This route calls `streamText(...).toTextStreamResponse()` — the exact same AI-streaming pattern as `app/api/insights/generate/route.ts` and `app/api/insights/daily/route.ts`, both of which declare `export const maxDuration = 60` and are registered in `vercel.json`'s `functions` block (per the documented CLAUDE.md convention: "Serverless function timeout: 60s max (10s default) — Set `export const maxDuration = 60` on AI routes only"). `06-RESEARCH.md`'s own Pattern 3 target-state code sample (which this file matches almost verbatim) also omits it, so this looks like an oversight carried through from research into implementation rather than a deliberate choice. Without it, the chat route runs under Vercel's default 10-second function timeout; any response that takes Claude longer than ~10s to fully stream will be killed mid-generation, truncating the reply the user sees — a real, reproducible functional bug in production, not just a theoretical risk (`claude-sonnet-4-6` analytical responses are documented elsewhere in this repo as regularly taking 3-15+ seconds).
**Fix:**
```typescript
// app/api/leads/chat/route.ts
export const runtime = 'nodejs'
export const maxDuration = 60 // Fluid Compute allows up to 300s on Hobby; matches /api/insights/generate
```
```json
// vercel.json — add alongside the two existing insight routes
"functions": {
  "app/api/insights/generate/route.ts": { "maxDuration": 60 },
  "app/api/insights/daily/route.ts": { "maxDuration": 60 },
  "app/api/leads/chat/route.ts": { "maxDuration": 60 }
}
```

### WR-02: No upper bound on client-supplied `system`/message content sent to the shared Anthropic key

**File:** `app/api/leads/chat/route.ts:10-18`
**Issue:** `BodySchema` requires `system: z.string().min(1)` and `messages: z.array(MessageSchema).min(1)` with `content: z.string().min(1)` — none of these have a `.max()`. The route is reachable directly (not only through `agente/page.tsx`'s UI, which happens to cap its own sample to 50 leads client-side) by any authenticated `super_admin`/`tenant_admin`/`agency` user. Since the 20-requests/5-minute limiter (`lib/rate-limit.ts`) bounds *request count*, not *request size*, a single authorized-but-malicious caller can still send a small number of very large `system`/`messages` payloads to run up cost against the shared `ANTHROPIC_API_KEY`, or supply a `system` prompt entirely disconnected from the tenant's actual lead data (the server never validates that `system` was derived from the named tenant's leads — only that the caller is *authorized for* that tenant, per D-05). This is a genuine (if lower-severity, since it requires an already-authenticated privileged account) cost-abuse / prompt-injection surface that the phase's hardening didn't close.
**Fix:**
```typescript
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
})
const BodySchema = z.object({
  tenant: z.string().min(1),
  system: z.string().min(1).max(8000),
  messages: z.array(MessageSchema).min(1).max(40),
})
```

### WR-03: Missing `.catch()` on the initial leads fetch — unhandled rejection + silent failure

**File:** `app/[tenant-slug]/leads/agente/page.tsx:52-57`
**Issue:**
```typescript
useEffect(() => {
  fetch(`/api/leads?tenant=${slug}`)
    .then(r => r.json())
    .then(d => { if (d.leads) setLeads(d.leads) })
    .finally(() => setLoadingLeads(false))
}, [slug])
```
There is no `.catch()` on this promise chain and no check of `r.ok` before calling `r.json()`. If the network request fails outright, or the server returns a non-JSON body, this produces an unhandled promise rejection (visible only in the console) and the user is left on the loading-complete state with an empty `leads` array and no visible error — the agent chat then silently operates as if the tenant has zero leads, which is misleading rather than an obvious failure. `slug` is also interpolated into the URL unencoded.
**Fix:**
```typescript
useEffect(() => {
  fetch(`/api/leads?tenant=${encodeURIComponent(slug)}`)
    .then(r => r.json())
    .then(d => { if (d.leads) setLeads(d.leads) })
    .catch(() => setLeads([])) // TODO: surface a visible error state instead of failing silently
    .finally(() => setLoadingLeads(false))
}, [slug])
```

## Info

### IN-01: Auth/role/tenant-scope block duplicated verbatim across `GET /api/leads` and `POST /api/leads/chat`

**File:** `app/api/leads/route.ts:12-51`, `app/api/leads/chat/route.ts:21-71`
**Issue:** The ~40-line role-gate + `getClaims()` tenant/agency scope-check block is now near-identical in three files (`PATCH /api/leads/[id]/status`, `GET /api/leads`, `POST /api/leads/chat`). `06-RESEARCH.md` (Pitfall 4 / Open Question 1) explicitly considered and consciously deferred extracting this into a shared helper, reading D-04's "espelhar exatamente" as favoring verbatim duplication for this phase — so this is a documented, deliberate tradeoff, not an oversight. Flagging it anyway because it's exactly the kind of drift risk this phase's title calls out: a future edit to one copy (e.g., adding a 4th allowed role, or changing the 403 message) that isn't mirrored to the other two would silently reintroduce the inconsistency this phase was created to fix.
**Fix:** Consider extracting to a shared helper (e.g., `lib/auth/tenant-scope.ts::requireTenantScope(supabase, tenantSlug)`) the next time a 4th call site needs the same check, or as a dedicated follow-up refactor — not blocking for this phase per the already-recorded decision.

### IN-02: Google Sheets API URL built without encoding `sheet_id`/`sheets_api_key`

**File:** `app/api/leads/route.ts:66`
**Issue:** `` `https://sheets.googleapis.com/v4/spreadsheets/${tenant.sheet_id}/values/Leads!A2:H500?key=${tenant.sheets_api_key}` `` interpolates both values directly into the URL without `encodeURIComponent`. Both values are admin-set (not end-user input), so this isn't attacker-reachable today, but any future path that lets a tenant admin self-configure these fields would turn a stray `&`/`#`/space character into a broken or query-string-injected request.
**Fix:**
```typescript
const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(tenant.sheet_id)}/values/Leads!A2:H500?key=${encodeURIComponent(tenant.sheets_api_key)}`
```

### IN-03: `GET /api/leads` has no rate limiting, unlike `POST /api/leads/chat`

**File:** `app/api/leads/route.ts` (entire file), contrast with `lib/rate-limit.ts` usage in `app/api/leads/chat/route.ts:75`
**Issue:** This asymmetry is plausibly intentional — D-02/D-03 in `06-CONTEXT.md` scope the rate limiter specifically to the costed Anthropic key, and Sheets reads are further throttled by the existing 60s `next.revalidate` cache tag. Noting it here only because "consistency" is this phase's explicit theme and a future reader could otherwise mistake the asymmetry for an unfinished gate. No action required unless Sheets API quota exhaustion becomes an observed problem.
**Fix:** None required now; if this becomes a concern, reuse `checkRateLimit(user.id, {...})` with a looser budget (e.g., 60/min) before the Sheets fetch.

### IN-04: `leads-get-route.test.ts` never exercises the actual Google Sheets fetch path

**File:** `tests/unit/leads-get-route.test.ts:47`
**Issue:** `beforeEach` sets `mockState.tenant = { sheet_id: 'sheet-123', sheets_api_key: null }`, which makes every test in this file hit the early `{ leads: [], configured: false }` return (`app/api/leads/route.ts:62-64`) before the real `fetch(url, ...)` call is ever reached. None of the 10 tests cover the branch where `sheets_api_key` is present — i.e., the `res.ok === false` error path (`route.ts:68-71`) and the row-to-`Lead` mapping logic (`route.ts:74-85`) are entirely untested by this file.
**Fix:** Add at least one test with `mockState.tenant = { sheet_id: 'x', sheets_api_key: 'y' }` and a mocked global `fetch` (success + a `res.ok === false` case) to cover the remaining branches.

---

_Reviewed: 2026-07-11T17:41:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
