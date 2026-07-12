---
phase: 06
slug: security-consistency-leads-endpoints
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
validated: 2026-07-11
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 |
| **Config file** | none dedicated — relies on `vite-tsconfig-paths` + Vitest defaults, matches existing `tests/unit/leads-status-route.test.ts` and `tests/unit/insights-generate-route.test.ts` |
| **Quick run command** | `npx vitest run tests/unit/leads-get-route.test.ts tests/unit/leads-chat-route.test.ts tests/unit/rate-limit.test.ts` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific new/modified test file (e.g. `npx vitest run tests/unit/leads-chat-route.test.ts`)
- **After every plan wave:** Run `npm test` (full suite — currently 183+ tests passing per STATE.md)
- **Before `/gsd-verify-work`:** Full suite must be green, plus `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` must return empty (D-08's literal success criterion)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | AGENCY-08 | T-06-01 | `checkRateLimit()` allows up to max, rejects max+1, resets after window, isolates by key | unit | `npx vitest run tests/unit/rate-limit.test.ts` | ✅ | ✅ green (4/4) |
| 06-01-02 | 01 | 0 | AGENCY-08 | T-06-02 | `GET /api/leads`: 401 no auth / 403 wrong role / 403 tenant_admin mismatch / 200 tenant_admin match / 403-or-200 agency grant / 200 super_admin | unit | `npx vitest run tests/unit/leads-get-route.test.ts` | ✅ | ✅ green (10/10) |
| 06-01-03 | 01 | 0 | AGENCY-08 | T-06-03 | `POST /api/leads/chat`: 401 no auth / 400 missing tenant / 403 wrong role / 403-or-200 tenant+agency scope / 429 on 21st call with `Retry-After` / uses `streamText`+`insightModel` not raw fetch | unit | `npx vitest run tests/unit/leads-chat-route.test.ts` | ✅ | ✅ green (10/10) |
| 06-01-04 | 02 | 1 | AGENCY-08 | — | `GET /api/leads` route implements role gate + `getClaims()` scope (Pattern 1/2) | unit | `npx vitest run tests/unit/leads-get-route.test.ts` | ✅ | ✅ green (10/10, Plan 02) |
| 06-01-05 | 03 | 1 | AGENCY-08 | T-06-01..03 | `POST /api/leads/chat` implements role gate + `getClaims()` scope + rate limit + SDK migration (Pattern 3/4) | unit | `npx vitest run tests/unit/leads-chat-route.test.ts` | ✅ | ✅ green (10/10, Plan 03) |
| 06-01-06 | 03/04 | 1/2 | — | Pitfall 3 | `agente/page.tsx` reads streamed text (`res.body.getReader()`/`TextDecoder`), not `res.json()` | manual | Browser smoke test — send chat message, verify reply renders (see Manual-Only Verifications) | N/A | ⚠️ partial — error-rendering path confirmed live in production (Plan 04); success-path streamed render blocked by missing `ANTHROPIC_API_KEY` in Vercel (pre-existing Phase 4 gap) |
| 06-01-07 | 03 | 1 | D-08 | — | No untracked files remain under `app/api/leads/` or `app/[tenant-slug]/leads/` | manual / repo-state check | `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` → empty output | N/A | ✅ green — confirmed empty |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/unit/leads-get-route.test.ts` — new file, covers AGENCY-08 for `GET /api/leads`. Mirror `tests/unit/leads-status-route.test.ts`'s mock structure (`mockState.user`/`role`/`roleError`/`grant`, `vi.mock('@/lib/supabase/server', ...)`).
- [x] `tests/unit/leads-chat-route.test.ts` — new file, covers F3 hardening + SDK migration for `POST /api/leads/chat`. Mirror `tests/unit/insights-generate-route.test.ts`'s `vi.mock('ai', () => ({ streamText: () => ({ toTextStreamResponse: () => new Response('ok') }) }))` pattern combined with `leads-status-route.test.ts`'s role/scope mock structure.
- [x] `tests/unit/rate-limit.test.ts` — new file, pure unit tests for `lib/rate-limit.ts`'s `checkRateLimit()` using `vi.useFakeTimers()`/`vi.setSystemTime()` to avoid real 5-minute waits.
- [x] Framework install: none — Vitest already configured and used by 3+ existing test files in this exact domain.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Result |
|----------|-------------|------------|-------------------|--------|
| Chat UI renders streamed reply correctly after SDK migration | F3 (Pitfall 3) | Requires a real browser session against the running dev server to observe incremental text rendering, which a unit-mocked `streamText` cannot exercise end-to-end | 1. Run dev server, log in as `tenant_admin`. 2. Open `/{tenant}/leads/agente`. 3. Send a message. 4. Confirm the reply streams in as text (not `[object Object]`/JSON/blank). 5. Confirm no console errors. | ⚠️ Partial (Plan 04, 2026-07-11, live production via Playwright MCP): auth/role/scope gate passed real traffic and the client correctly rendered the server's JSON error (`ANTHROPIC_API_KEY não configurada.`) as readable text — confirming the Pitfall-3 client read-path change works. The success-path streamed render itself is unverified because `ANTHROPIC_API_KEY` is not set in Vercel Production (pre-existing Phase 4 gap, tracked in `04-HUMAN-UAT.md` item 4 — not a Phase 6 defect). User explicitly accepted this as partial via AskUserQuestion. |
| Rate limit UX at 429 | F3 (D-03) | Requires 21 rapid real requests against a running route to observe the actual HTTP response/UI error message, beyond what the unit test's mocked loop asserts | 1. As an authenticated user, send 21 chat messages within 5 minutes (script or rapid manual sends). 2. Confirm the 21st shows the pt-BR rate-limit error message with retry time, not a generic failure. | ⬜ Not performed (Plan 04): no `tenant_admin`/repeat-send session was run against production; deprioritized alongside the same `ANTHROPIC_API_KEY` gap. Automated coverage exists at the unit level (`leads-chat-route.test.ts`'s 21st-call 429 + `Retry-After` assertion, green) — this manual item only adds live-UX confirmation, not new behavioral coverage. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-11

---

## Validation Audit 2026-07-11

| Metric | Count |
|--------|-------|
| Requirements audited | 7 (06-01-01..07) |
| Gaps found | 0 |
| Resolved | 0 (no gaps — all automatable requirements already had green tests from Wave 0 + Plans 02/03) |
| Escalated | 0 |
| Manual-only items | 2 (1 partial, 1 not performed — both pre-existing blockers, see Manual-Only Verifications) |

**Audit method:** Re-ran `npx vitest run tests/unit/leads-get-route.test.ts tests/unit/leads-chat-route.test.ts tests/unit/rate-limit.test.ts` — 24/24 green. Re-ran `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` — confirmed empty (D-08). Cross-referenced 06-01 through 06-04 SUMMARY.md files against the Per-Task Verification Map; no discrepancies found between claimed and actual test/commit state. `gsd-nyquist-auditor` was not spawned — no MISSING or PARTIAL automated-test gaps existed to fill; the only open items are inherently-manual behaviors already exercised as far as possible in Plan 04 and blocked on a documented external dependency (`ANTHROPIC_API_KEY` in Vercel), not a test-coverage gap.

**Verdict:** Phase 06 is Nyquist-compliant. `nyquist_compliant: true`.
