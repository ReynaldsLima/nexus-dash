---
phase: 09-limpeza-do-papel-viewer
verified: 2026-07-12T00:15:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 09: Limpeza do Papel Viewer Verification Report

**Phase Goal:** O papel "viewer" — já impossível de existir no banco desde a migration `0020` (Phase 5) — deixa de existir também na camada de aplicação (tipos, middleware, componentes, testes), removendo código morto e simplificando o `Role` type antes de a UI de gestão de usuários ser construída sobre ele.
**Verified:** 2026-07-12T00:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `Role` type em `lib/stores/tenant-store.tsx` não inclui `'viewer'` | VERIFIED | Line 13: `export type Role = 'super_admin' \| 'tenant_admin' \| 'agency' \| 'none' \| null` (exact match to must_have) |
| 2 | `proxy.ts` não contém branch condicional para `'viewer'` | VERIFIED | Line 5 `AppMetadata.role` union has no `'viewer'`; line 68 branch is `role === 'tenant_admin' && tenantSlug` (viewer disjunct removed) |
| 3 | Prop `role` de `tenant-switcher.tsx` não lista `'viewer'` | VERIFIED | Line 13: `role: 'super_admin' \| 'tenant_admin' \| 'agency' \| string \| null` — no `'viewer'` literal (escape hatch `\| string` preserved per plan decision) |
| 4 | Comentário em `app/api/meta-ads/connect/route.ts` não menciona `'viewer'` | VERIFIED | Line 43: `// Uses get_user_role() RPC (returns 'super_admin' \| 'tenant_admin')` |
| 5 | Suíte de testes passa com sentinel `'invalid_role'` em vez de `'viewer'` | VERIFIED | `npx vitest run` on the 6 affected files: 6 files, 60/60 tests passed. `grep -rln "'viewer'"` across all `.ts`/`.tsx` files (excluding node_modules/.next) returns only `tests/integration/tenant-role-migration.test.ts` (deliberately out of scope) |
| 6 | `npx tsc --noEmit` compila limpo exceto os 2 erros pré-existentes | VERIFIED | Ran `npx tsc --noEmit`: exactly 2 errors, both in `tests/integration/vault-rpc.test.ts` lines 124/135 (pre-existing, documented in STATE.md, unrelated to this phase) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/stores/tenant-store.tsx` | `Role` type sem `'viewer'` | VERIFIED | Exact string match confirmed |
| `proxy.ts` | `AppMetadata.role` sem `'viewer'` e branch de redirect sem `'viewer'` | VERIFIED | Both the type and the branch condition confirmed edited |
| `components/tenants/tenant-switcher.tsx` | prop `role` sem `'viewer'` | VERIFIED | Confirmed, `\| string` escape hatch intentionally kept |
| `app/api/meta-ads/connect/route.ts` | comentário do RPC corrigido | VERIFIED | Comment updated, RPC call itself untouched (as scoped) |
| `tests/middleware.test.ts` + 5 route test files | sentinel `'invalid_role'` aplicado | VERIFIED | 14 occurrences of `invalid_role` across the 6 files (4 in middleware.test.ts, 2 each in the 5 route tests) matching plan's exact count |
| `tests/integration/tenant-role-migration.test.ts` | intencionalmente intocado | VERIFIED | `grep -c "viewer"` returns 3 — literal preserved to prove migration 0020 CHECK constraint |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `proxy.ts` branch de redirect por papel | redirect para `/${tenantSlug}/dashboard` | `role === 'tenant_admin'` (sem `\|\| role === 'viewer'`) | WIRED | Line 68 confirmed: `} else if (role === 'tenant_admin' && tenantSlug) {` — single condition, no `viewer` disjunct, branch body unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Affected test files pass with sentinel | `npx vitest run tests/middleware.test.ts tests/unit/{google-ads-connect,insights-generate,leads-status,leads-get,leads-chat}-route.test.ts` | 6 files, 60 tests, all passed | PASS |
| Type-check has no new errors | `npx tsc --noEmit` | 2 errors, both pre-existing in `tests/integration/vault-rpc.test.ts` | PASS |
| Task commits present in git history | `git show --stat e8f6379`, `git show --stat 09a3c96` | Both commits found, diffs match SUMMARY claims exactly (proxy.ts 4 lines, tenant-store.tsx 2 lines, tenant-switcher.tsx 2 lines, meta-ads route 2 lines; 6 test files 4-8 lines each) | PASS |
| No `'viewer'` literal remains anywhere in app-layer TS/TSX | `grep -rln "'viewer'" --glob "*.{ts,tsx}"` (repo-wide) | Only `tests/integration/tenant-role-migration.test.ts` matched (deliberately out of scope) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-07 | 09-01-PLAN.md | Nenhuma referência ao valor `"viewer"` permanece em tipos TS, middleware, componentes ou testes | SATISFIED | All 4 named locations (Role type, proxy.ts, tenant-switcher.tsx, tests) confirmed clean; REQUIREMENTS.md line 20 already marked `[x]` and traceability table (line 59) marks Phase 9 as Complete |

No orphaned requirements — AUTH-07 is the only requirement mapped to Phase 9 in REQUIREMENTS.md, and it is claimed in the plan's frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `proxy.ts` | 10-20 | `decodeJwtClaims` uses `atob()` instead of base64url-safe decoding (pre-existing, flagged in 09-REVIEW.md WR-01) | Info (out of scope) | Not introduced by this phase — the diff only touched the type union (line 5) and the branch condition (line 68), not `decodeJwtClaims`. Confirmed via `git show --stat e8f6379` (4 line changes only). Real bug, but unrelated to AUTH-07's scope; should be tracked separately, not a blocker for this phase's goal. |
| `proxy.ts` | 107-111 | Matcher does not exclude `/api/*` (pre-existing, flagged in 09-REVIEW.md WR-02) | Info (out of scope) | Same reasoning — pre-existing, untouched by this phase's diff. |
| `tests/middleware.test.ts` | 1-74 | Test file doesn't actually invoke `proxy()` (pre-existing, flagged in 09-REVIEW.md WR-04) | Info (out of scope) | Structural test-quality issue predating this phase; this phase only swapped literal values inside the existing (already-disconnected) test bodies, per plan scope. |
| `components/tenants/tenant-switcher.tsx` | 13 | `\| string` widens the role union, defeating exhaustiveness (flagged in 09-REVIEW.md IN-04) | Info (accepted by plan) | Explicitly kept per plan's discretion decision #3 ("`\| string` em `tenant-switcher.tsx` fica") — intentional, not a gap. |

These four items were already surfaced in `09-REVIEW.md` (code review, standard depth) as warnings/info on pre-existing code or explicitly-scoped-out decisions. None are regressions introduced by this phase's edits, and none touch the AUTH-07 requirement or the 4 roadmap success criteria. They are noted here for completeness but do not block phase goal achievement.

### Human Verification Required

None. This phase is a pure application-layer code cleanup (type unions, one conditional branch, one comment, test literal substitutions) with no UI, visual, or runtime-behavior surface that requires manual testing beyond the automated grep/tsc/vitest checks already run above.

### Gaps Summary

No gaps found. All 4 roadmap success criteria and all 6 plan must-haves are verified against the actual codebase (not just SUMMARY claims):

- `Role` type, `proxy.ts` (type + branch), and `tenant-switcher.tsx` prop type all confirmed edited exactly as specified, with the `'viewer'` literal absent.
- The 6 test files confirmed using the `'invalid_role'` sentinel (14 occurrences matching the plan's expected count), and the deliberately out-of-scope `tests/integration/tenant-role-migration.test.ts` confirmed untouched (`'viewer'` still present, count 3).
- `npx tsc --noEmit` produces exactly the 2 pre-existing, documented errors — no new regressions.
- `npx vitest run` on the 6 affected files: 60/60 tests pass.
- Both task commits (`e8f6379`, `09a3c96`) exist in git history with diffs matching the SUMMARY's claims exactly.
- A repo-wide grep for the `'viewer'` string literal across all `.ts`/`.tsx` files confirms zero remaining references outside the one deliberately-excluded migration test.

Pre-existing bugs surfaced in `09-REVIEW.md` (JWT base64url decoding, middleware matcher scope, disconnected middleware test) are real but out of this phase's scope — they predate this phase's diff and are unrelated to the `'viewer'` role removal goal.

---

_Verified: 2026-07-12T00:15:00Z_
_Verifier: Claude (gsd-verifier)_
