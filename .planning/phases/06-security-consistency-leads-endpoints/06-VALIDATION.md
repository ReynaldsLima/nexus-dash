---
phase: 06
slug: security-consistency-leads-endpoints
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
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
| 06-01-01 | 01 | 0 | AGENCY-08 | T-06-01 | `checkRateLimit()` allows up to max, rejects max+1, resets after window, isolates by key | unit | `npx vitest run tests/unit/rate-limit.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | AGENCY-08 | T-06-02 | `GET /api/leads`: 401 no auth / 403 wrong role / 403 tenant_admin mismatch / 200 tenant_admin match / 403-or-200 agency grant / 200 super_admin | unit | `npx vitest run tests/unit/leads-get-route.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 0 | AGENCY-08 | T-06-03 | `POST /api/leads/chat`: 401 no auth / 400 missing tenant / 403 wrong role / 403-or-200 tenant+agency scope / 429 on 21st call with `Retry-After` / uses `streamText`+`insightModel` not raw fetch | unit | `npx vitest run tests/unit/leads-chat-route.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | AGENCY-08 | — | `GET /api/leads` route implements role gate + `getClaims()` scope (Pattern 1/2) | unit | `npx vitest run tests/unit/leads-get-route.test.ts` | ✅ (after W0) | ⬜ pending |
| 06-01-05 | 01 | 1 | AGENCY-08 | T-06-01..03 | `POST /api/leads/chat` implements role gate + `getClaims()` scope + rate limit + SDK migration (Pattern 3/4) | unit | `npx vitest run tests/unit/leads-chat-route.test.ts` | ✅ (after W0) | ⬜ pending |
| 06-01-06 | 01 | 1 | — | Pitfall 3 | `agente/page.tsx` reads streamed text (`res.body.getReader()`/`TextDecoder`), not `res.json()` | manual | Browser smoke test — send chat message, verify reply renders (see Manual-Only Verifications) | N/A | ⬜ pending |
| 06-01-07 | 01 | 1 | D-08 | — | No untracked files remain under `app/api/leads/` or `app/[tenant-slug]/leads/` | manual / repo-state check | `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` → empty output | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/leads-get-route.test.ts` — new file, covers AGENCY-08 for `GET /api/leads`. Mirror `tests/unit/leads-status-route.test.ts`'s mock structure (`mockState.user`/`role`/`roleError`/`grant`, `vi.mock('@/lib/supabase/server', ...)`).
- [ ] `tests/unit/leads-chat-route.test.ts` — new file, covers F3 hardening + SDK migration for `POST /api/leads/chat`. Mirror `tests/unit/insights-generate-route.test.ts`'s `vi.mock('ai', () => ({ streamText: () => ({ toTextStreamResponse: () => new Response('ok') }) }))` pattern combined with `leads-status-route.test.ts`'s role/scope mock structure.
- [ ] `tests/unit/rate-limit.test.ts` — new file, pure unit tests for `lib/rate-limit.ts`'s `checkRateLimit()` using `vi.useFakeTimers()`/`vi.setSystemTime()` to avoid real 5-minute waits.
- [ ] Framework install: none — Vitest already configured and used by 3+ existing test files in this exact domain.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat UI renders streamed reply correctly after SDK migration | F3 (Pitfall 3) | Requires a real browser session against the running dev server to observe incremental text rendering, which a unit-mocked `streamText` cannot exercise end-to-end | 1. Run dev server, log in as `tenant_admin`. 2. Open `/{tenant}/leads/agente`. 3. Send a message. 4. Confirm the reply streams in as text (not `[object Object]`/JSON/blank). 5. Confirm no console errors. |
| Rate limit UX at 429 | F3 (D-03) | Requires 21 rapid real requests against a running route to observe the actual HTTP response/UI error message, beyond what the unit test's mocked loop asserts | 1. As an authenticated user, send 21 chat messages within 5 minutes (script or rapid manual sends). 2. Confirm the 21st shows the pt-BR rate-limit error message with retry time, not a generic failure. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
