---
phase: 06-security-consistency-leads-endpoints
audited: 2026-07-11
asvs_level: 1
block_on: critical
threats_total: 7
threats_closed: 7
threats_open: 0
---

# Phase 6: Security Audit — Threat Mitigation Verification

**Scope:** Verify that every threat declared in the Phase 6 plans' `<threat_model>` blocks (06-01 through 06-04 PLAN.md) has its declared mitigation present in the implemented code, per the mitigation plan on record — not a blind re-scan for new vulnerabilities.

## Threat Register Verification

| Threat ID | Category | Component | Disposition | Verification Method | Status | Evidence |
|-----------|----------|-----------|-------------|----------------------|--------|----------|
| T-06-01 | Denial of Service + Elevation of Privilege (shared Anthropic key abuse) | `POST /api/leads/chat` | mitigate | grep for `checkRateLimit(user.id, ...)` placed after auth, 429 + `Retry-After` | **CLOSED** | `app/api/leads/chat/route.ts:75-81` — `checkRateLimit(user.id, { max: 20, windowMs: 5 * 60 * 1000 })` called after auth (step 5, after role gate/body validation/scope check); on `!rl.allowed` returns `429` with `Retry-After` header set to `rl.retryAfterSeconds`. `lib/rate-limit.ts` implements the sliding-window `Map`. `tests/unit/rate-limit.test.ts` (4/4) and `tests/unit/leads-chat-route.test.ts` 21st-call case (10/10) both green. |
| T-06-02 | Elevation of Privilege (IDOR/BOLA, OWASP API1:2023) | `GET /api/leads` | mitigate | grep for `rpc('get_user_role')` + `getClaims()` scope check, fail-closed | **CLOSED** | `app/api/leads/route.ts:17-51` — role gate (403 on RPC error/null role or role outside `{super_admin, tenant_admin, agency}`) followed by `getClaims()`-sourced scope check: `tenant_admin` requires matching `tenant_slug` claim, `agency` requires `agency_id` claim + live `agency_tenants` grant (`.eq('tenants.slug', tenantSlug).maybeSingle()`), `super_admin` passes through. Fails closed on every branch. `tests/unit/leads-get-route.test.ts` 10/10 green. |
| T-06-02b | Repudiation (runtime misconfiguration — getClaims() silently no-ops off Node) | `GET /api/leads` runtime | mitigate | grep for `export const runtime = 'nodejs'` | **CLOSED** | `app/api/leads/route.ts:5` — `export const runtime = 'nodejs'` present, with an explicit comment noting `getClaims()` requires Node's RS256/crypto (unavailable on Edge). |
| T-06-03 | Elevation of Privilege (IDOR/BOLA, OWASP API1:2023) | `POST /api/leads/chat` | mitigate | grep for role gate + required `tenant` body field + `getClaims()` scope, fail-closed, `runtime='nodejs'` | **CLOSED** | `app/api/leads/chat/route.ts:8,26-33,44,52-70` — `runtime='nodejs'` (line 8); role gate identical to GET route; Zod `BodySchema.tenant: z.string().min(1)` makes `tenant` a required field (400 if absent); `getClaims()`-sourced scope check byte-identical to `GET /api/leads` and the PATCH precedent, fail-closed on every branch. `tests/unit/leads-chat-route.test.ts` 10/10 green. |
| T-06-04 | Repudiation / Tampering (security-relevant code living outside version control) | `app/api/leads/chat/route.ts`, `app/[tenant-slug]/leads/agente/page.tsx` (previously untracked) | mitigate | `git status --porcelain` under leads paths must return empty | **CLOSED** | Ran `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` directly during this audit → **empty output**. Commits `0094999`, `b028274`, `c244d3a` (Plan 03) and `008251c` (Plan 02) confirmed in git log per 06-03-SUMMARY.md/06-VERIFICATION.md. |
| T-06-05 | Tampering (unvalidated request body — formula/prompt injection surface) | `POST /api/leads/chat` request body | mitigate | grep for Zod `zod/v4` schema validating shape + min-length before use | **CLOSED** | `app/api/leads/chat/route.ts:3,10-18,40-43` — `import { z } from 'zod/v4'`; `MessageSchema`/`BodySchema` validate `tenant`/`system`/`messages` shape and `.min(1)` length; `safeParse` result checked, 400 returned with the first Zod issue message on failure, before any field is used downstream. **Residual note (not part of the declared mitigation, flagged by 06-REVIEW.md WR-02, carried forward below):** no `.max()` upper bound exists on `system`/`content` — an authenticated privileged caller could still send oversized payloads against the shared Anthropic key. This does not reopen T-06-05 as declared (shape + min-length validation, which is present and correct) but is tracked as a residual follow-up. |
| T-06-06 | Tampering (broken client/server contract after SDK migration — JSON→text-stream) | `app/[tenant-slug]/leads/agente/page.tsx` streamed read | mitigate (verify) | Confirm `res.body.getReader()`/`TextDecoder` mechanism present in client code; production spot-check of at least the error-rendering path | **CLOSED** | Code: `app/[tenant-slug]/leads/agente/page.tsx:83-107` — non-OK/no-body responses parsed as JSON `{error}` (old contract, still correct for error responses); success path reads `res.body.getReader()` + `TextDecoder`, accumulating into an assistant message. Live: 06-04-SUMMARY.md records a Playwright MCP session against production (`https://nexusdash-chi.vercel.app`) where a real chat send reached the hardened route, failed closed with the literal `ANTHROPIC_API_KEY não configurada.` message, and the client rendered that JSON error as readable text (not `[object Object]`/raw JSON/blank) — proving the exact Pitfall-3 regression this threat targets does not occur. Per this audit's explicit instruction, the residual "full success-path streaming not exercised" is treated as an accepted, externally-blocked dependency (missing `ANTHROPIC_API_KEY` in Vercel Production, tracked since Phase 4 in `04-HUMAN-UAT.md` item 4) rather than an open Phase 6 threat. |

**Result: 7/7 threats CLOSED. 0 open.**

## Unregistered / Residual Findings (informational — not blockers)

No `## Threat Flags` section was present in any of the four Phase 6 SUMMARY.md files (06-01 through 06-04), so no executor-flagged new attack surface required mapping in this audit.

`06-REVIEW.md` (code review, already in the phase's file set) surfaced two warnings that touch this phase's declared threats but are outside their literal mitigation-plan wording, carried forward here for visibility rather than as reopened threats:

| Finding | Related Threat | Why not reopening | Recommended follow-up |
|---------|----------------|--------------------|------------------------|
| WR-01: `POST /api/leads/chat` has no `export const maxDuration = 60` and is not registered in `vercel.json`'s `functions` block, unlike its `streamText` sibling routes (`/api/insights/generate`, `/api/insights/daily`) | Adjacent to T-06-01 (cost/availability boundary) but not part of T-06-01's declared mitigation (rate limiting) | The declared T-06-01 mitigation (per-user rate limit) is present and verified; the missing `maxDuration` is a distinct availability risk (Vercel's default 10s timeout could kill a long Claude stream mid-response), not an unmitigated instance of the registered threat | Add `maxDuration = 60` to the route and register it in `vercel.json`, matching the two existing insight routes |
| WR-02: No `.max()` upper bound on `system`/`messages[].content` in `BodySchema` | T-06-05 (as noted in the table above) | T-06-05's declared mitigation (shape + min-length Zod validation) is present and correct; an upper bound was never part of the declared mitigation plan | Add `.max()` bounds (e.g. `content: z.string().min(1).max(4000)`, `messages: z.array(...).max(40)`) per 06-REVIEW.md's suggested fix |

Neither finding is Critical severity (matches `block_on: critical` — no block triggered) and both were already surfaced and accepted as non-blocking by `06-REVIEW.md`/`06-VERIFICATION.md`.

## Accepted Risks Log

None newly recorded by this audit. The one accepted, out-of-scope gap already on record (missing `ANTHROPIC_API_KEY` in Vercel Production, blocking full success-path exercise of T-06-06/T-06-01's live UX) is tracked against **Phase 4** (`04-HUMAN-UAT.md` item 4), not Phase 6, and was explicitly accepted by the user during Plan 04's execution (see `06-VERIFICATION.md` frontmatter `overrides` block).

## ASVS Level 1 Note

At ASVS Level 1, the verified controls — server-side authorization derived from verified claims (never client-supplied identifiers), fail-closed role/scope checks, input validation before use, and rate limiting on a costed shared credential — meet the applicable baseline requirements for the audited endpoints. No ASVS L1 control was found missing for the threats in scope.
