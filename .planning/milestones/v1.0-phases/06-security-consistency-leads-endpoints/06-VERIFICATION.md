---
phase: 06-security-consistency-leads-endpoints
verified: 2026-07-11T17:55:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "The Agente IA chat renders the streamed reply as readable text after the SDK migration (no [object Object]/JSON error) / Exceeding the rate limit surfaces the pt-BR 429 message with a retry time"
    reason: "User directed Plan 04's human-verify checkpoint to run against live Vercel production via Playwright instead of local dev. Confirmed live: the auth/role/scope gate on POST /api/leads/chat passes real traffic correctly, and the chat client renders server-side JSON error responses as readable text (not [object Object]/raw JSON) — this is the exact Pitfall-3 regression risk the checkpoint exists to catch, and it passed. NOT confirmed: a full streamed successful reply and the 429 UX, both of which require a working Claude call — blocked solely by a missing ANTHROPIC_API_KEY Vercel Production env var, a pre-existing gap tracked since Phase 4 (04-HUMAN-UAT.md item 4), not a Phase 6 code defect. The underlying code paths (streamText call, rate limiter 429 response, Retry-After header) are exercised and green in tests/unit/leads-chat-route.test.ts and tests/unit/rate-limit.test.ts. User explicitly accepted this as sufficient for phase completion."
    accepted_by: "user (via AskUserQuestion during Plan 04 execution)"
    accepted_at: "2026-07-11"
---

# Phase 6: Security & Consistency — Leads Endpoints Verification Report

**Phase Goal:** Close two findings from the v1.0 milestone audit (2026-07-10): an uncommitted, unauthorized-scope AI chat endpoint riding on the leads feature, and a leads read-endpoint that doesn't follow the explicit authorization pattern AGENCY-08 established.
**Verified:** 2026-07-11T17:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `GET /api/leads` derives tenant/agency scope explicitly via `getClaims()`, matching the PATCH route pattern (AGENCY-08) | ✓ VERIFIED | `app/api/leads/route.ts` lines 17-51: role gate via `rpc('get_user_role')`, scope via `getClaims()` (tenant_slug match / agency_tenants grant), `runtime='nodejs'`. `tests/unit/leads-get-route.test.ts` 10/10 green |
| 2 | `POST /api/leads/chat` enforces the same role/scope gate, plus rate limiting, and calls Claude via the shared SDK wrapper (not raw fetch) | ✓ VERIFIED | `app/api/leads/chat/route.ts`: auth → role gate → Zod body validation (`tenant` required) → `getClaims()` scope → `checkRateLimit(user.id, {max:20, windowMs:300000})` → `streamText({model: insightModel, ...})`. No `fetch('https://api.anthropic.com...')` remains. `tests/unit/leads-chat-route.test.ts` 10/10 green |
| 3 | `checkRateLimit()` allows up to max calls/window per key and rejects further calls with a positive retry time | ✓ VERIFIED | `lib/rate-limit.ts` — sliding-window `Map<string, number[]>`, lazy-pruned. `tests/unit/rate-limit.test.ts` 4/4 green (allow-to-max, reject max+1, reset-after-window via fake timers, per-key isolation) |
| 4 | The chat client sends an explicit `tenant` field and reads the streamed text body (not `res.json()`) | ✓ VERIFIED | `app/[tenant-slug]/leads/agente/page.tsx` lines 76-107: body includes `tenant: slug`; success path uses `res.body.getReader()` + `TextDecoder`; error path still parses JSON `{error}` |
| 5 | No untracked files remain under `app/api/leads/` or `app/[tenant-slug]/leads/` | ✓ VERIFIED | `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` returns empty. Commits `0094999`, `b028274`, `c244d3a`, `008251c` confirmed in git log |
| 6 | Scope is always sourced from `getClaims()`, never `getUser().app_metadata` | ✓ VERIFIED | `grep "getUser().app_metadata"` across both routes returns nothing; `getClaims()` used in both |
| 7 | The Agente IA chat renders a streamed reply as readable text (no `[object Object]`/JSON error) | ✓ PASSED (override) | Confirmed live in production for the error-JSON-as-text path (Pitfall 3). Full successful streamed-reply render not exercised — blocked on pre-existing missing `ANTHROPIC_API_KEY` (Phase 4 gap). User accepted. See override above |
| 8 | Exceeding the rate limit surfaces the pt-BR 429 message with a retry time | ✓ PASSED (override) | Code path verified via unit test (`tests/unit/leads-chat-route.test.ts` 21st-call case, 429 + `Retry-After`). End-to-end production exercise blocked on the same pre-existing `ANTHROPIC_API_KEY` gap. User accepted. See override above |

**Score:** 8/8 truths verified (6 fully verified + 2 accepted via override)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/leads/route.ts` | GET with role gate + getClaims() scope | ✓ VERIFIED | Wired, substantive, tests green |
| `app/api/leads/chat/route.ts` | Hardened chat route: role gate + scope + rate limit + SDK migration | ✓ VERIFIED | Wired, substantive, tests green, committed |
| `lib/rate-limit.ts` | In-memory sliding-window `checkRateLimit()` | ✓ VERIFIED | Exports `checkRateLimit`, no `setInterval`, module-level `Map` |
| `app/[tenant-slug]/leads/agente/page.tsx` | Client sends `tenant` + reads streamed text | ✓ VERIFIED | Committed, `getReader`/`TextDecoder` present, old JSON-parse removed |
| `tests/unit/rate-limit.test.ts` | RED→GREEN spec for limiter | ✓ VERIFIED | 4/4 passing |
| `tests/unit/leads-get-route.test.ts` | RED→GREEN spec for GET /api/leads | ✓ VERIFIED | 10/10 passing |
| `tests/unit/leads-chat-route.test.ts` | RED→GREEN spec for POST /api/leads/chat | ✓ VERIFIED | 10/10 passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/api/leads/route.ts` | `get_user_role` RPC | `supabase.rpc('get_user_role')` | ✓ WIRED | Present, gates 403 |
| `app/api/leads/route.ts` | `agency_tenants` grant | `supabase.from('agency_tenants')` | ✓ WIRED | `.eq('tenants.slug', tenantSlug).maybeSingle()` |
| `app/api/leads/chat/route.ts` | `lib/rate-limit.ts` | `checkRateLimit(user.id, ...)` | ✓ WIRED | Called after auth, before Claude call |
| `app/api/leads/chat/route.ts` | `lib/ai/anthropic.ts` (insightModel) | `streamText({model: insightModel, ...})` | ✓ WIRED | Confirmed, no raw fetch remains |
| `app/[tenant-slug]/leads/agente/page.tsx` | `POST /api/leads/chat` | fetch body includes `tenant: slug` | ✓ WIRED | Confirmed in `sendMessage()` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GET /api/leads` | `leads` | Google Sheets API fetch (unchanged from pre-phase logic) | Yes — real Sheets rows mapped to `Lead[]` | ✓ FLOWING |
| `POST /api/leads/chat` | streamed reply | `streamText(insightModel)` → Anthropic Claude | Yes in code path (unit-mocked in tests; live path returns fail-closed 500 only because `ANTHROPIC_API_KEY` is unset in Vercel Production, a Phase 4 infra gap) | ✓ FLOWING (code); blocked externally in prod |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AGENCY-08 | 06-02, 06-03 (also 05-08) | Tenant/agency-scoped write/read endpoints verify caller authorization server-side | ✓ SATISFIED | `GET /api/leads`, `POST /api/leads/chat`, and `PATCH /api/leads/[id]/status` all enforce identical `get_user_role()` + `getClaims()` scope gate. `REQUIREMENTS.md` line 58 already reflects this as fully satisfied |

No orphaned requirements — AGENCY-08 is the only requirement mapped to Phase 6 and it appears in all three execute plans' frontmatter.

### Anti-Patterns Found

From `06-REVIEW.md` (2026-07-11, 0 critical / 3 warning / 4 info) — none block the phase's stated success criteria, but are carried forward as recommended follow-up work:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/leads/chat/route.ts` | 1-8 | Missing `export const maxDuration = 60` and no `vercel.json` `functions` entry, unlike its own `streamText` sibling routes (`/api/insights/generate`, `/api/insights/daily`) | ⚠️ Warning (WR-01) | Under Vercel's default 10s function timeout, a Claude reply taking longer than ~10s would be killed mid-stream in production — a real, reproducible functional risk once `ANTHROPIC_API_KEY` is added |
| `app/api/leads/chat/route.ts` | 10-18 | No `.max()` upper bound on `system`/`messages[].content`; rate limiter bounds request count, not request size | ⚠️ Warning (WR-02) | An authorized-but-malicious caller could still send oversized payloads against the shared Anthropic key |
| `app/[tenant-slug]/leads/agente/page.tsx` | 52-57 | Initial leads `fetch` has no `.catch()` and no `r.ok` check; `slug` interpolated unencoded | ⚠️ Warning (WR-03) | Silent failure mode (empty leads, no visible error) on network/server error |
| `app/api/leads/route.ts`, `app/api/leads/chat/route.ts` | multiple | ~40-line role/scope-gate block duplicated verbatim across 3 files | ℹ️ Info (IN-01) | Documented, deliberate tradeoff per 06-RESEARCH.md; drift risk if only one copy is edited later |
| `app/api/leads/route.ts` | 66 | Sheets URL built without `encodeURIComponent` on admin-set values | ℹ️ Info (IN-02) | Not attacker-reachable today |
| `app/api/leads/route.ts` | n/a | No rate limiting on Sheets reads (asymmetric vs. chat route) | ℹ️ Info (IN-03) | Plausibly intentional — rate limiter scoped to the costed Anthropic key per D-02/D-03 |
| `tests/unit/leads-get-route.test.ts` | 47 | Never exercises the actual Sheets-fetch branch (`sheets_api_key` present) | ℹ️ Info (IN-04) | Coverage gap, not a functional defect |

None of these are Critical severity and none contradict a roadmap success criterion or a plan must-have — they are pre-existing code-review recommendations, not phase regressions.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit-test suite (26 files) | `npm test` | 26/26 files, 208 passed / 1 skipped / 5 todo of 214 | ✓ PASS |
| Phase 6 test files isolated | `npx vitest run tests/unit/rate-limit.test.ts tests/unit/leads-get-route.test.ts tests/unit/leads-chat-route.test.ts` | 3 files, 24/24 tests passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | Only the 2 pre-existing, documented `vault-rpc.test.ts` errors remain; no new errors | ✓ PASS |
| Git-clean check under leads paths | `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` | Empty output | ✓ PASS |
| Commit presence | `git log` for 06-01/02/03 commits | `45d43ee`, `2f3a414`, `b721889`, `008251c`, `0094999`, `b028274`, `c244d3a` all present | ✓ PASS |

### Human Verification Required

None outstanding. Plan 04's human-verify checkpoint was executed by the user directly against live Vercel production via Playwright MCP. Two of the four verification points were confirmed (auth/role/scope gate passes real traffic; chat client renders server error JSON as readable text). The remaining two (full streamed successful reply, 429 rate-limit UX) could not be exercised end-to-end only because `ANTHROPIC_API_KEY` is missing from Vercel Production — a pre-existing gap tracked since Phase 4 (`.planning/phases/04-ai-insights/04-HUMAN-UAT.md` item 4), not a Phase 6 defect. The user explicitly accepted this as sufficient for phase completion; see the `overrides` entry in this report's frontmatter. No further human action is required for Phase 6 itself — adding `ANTHROPIC_API_KEY` to Vercel remains tracked as a Phase 4 follow-up item.

### Gaps Summary

No gaps block Phase 6's stated goal. All three roadmap success criteria are met:
1. `POST /api/leads/chat` enforces explicit tenant/role scoping + rate limiting and is committed to git.
2. `GET /api/leads` derives tenant/agency scope explicitly via `getClaims()`, matching the PATCH route pattern.
3. No untracked files remain under `app/api/leads/` or `app/[tenant-slug]/leads/`.

The three code-review warnings (missing `maxDuration`, no payload size cap, missing `.catch()` on the leads fetch) are real and worth addressing, but they are not must-haves this phase committed to and do not block AGENCY-08 or the audit findings this phase targeted. The one accepted deviation (full streamed-reply/429-UX production exercise) is blocked by an external, already-tracked Phase 4 infrastructure item, not a Phase 6 code defect, and the user explicitly signed off on it.

---

_Verified: 2026-07-11T17:55:00Z_
_Verifier: Claude (gsd-verifier)_
