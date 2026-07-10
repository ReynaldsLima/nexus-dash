---
phase: 5
slug: agencia-multi-cliente
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05
validated: 2026-07-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 |
| **Config file** | `vitest.config.mts` — `environment: 'node'`, `include: ['tests/**/*.test.ts']`, setup file `./tests/setup.ts` |
| **Quick run command** | `npx vitest run tests/unit/<file>.test.ts` (or `tests/<file>.test.ts` for top-level suites) |
| **Full suite command** | `npm run test` (= `vitest run`) |
| **Estimated runtime** | ~30 seconds (full suite, based on existing project scale) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-file>.test.ts`
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + `tsc --noEmit` + `npm run build` (matches Phase 03.1's closing verification pattern)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Plan 01 Task 1 (scaffold) → Plan 02 Task 2 (real assertions) | 01, 02 | 1, 2 | AGENCY-06 | T-05-01 | Agency-scoped RLS returns only granted tenants' rows | integration | `npx vitest run tests/agency-rls.test.ts` | yes, 0 `it.todo()` remaining | ✅ covered |
| Plan 01 Task 1 (scaffold) → Plan 03 Task 1 (real assertions) | 01, 03 | 1, 3 | AGENCY-07 | — | `tenant_users.role` collapse leaves no row outside `('tenant_admin')` | integration | `npx vitest run tests/integration/tenant-role-migration.test.ts` | yes, 0 `it.todo()` remaining | ✅ covered |
| Plan 01 Task 2 (scaffold) → Plan 08 Task 2 (real assertions) | 01, 08 | 1, 3 | AGENCY-08 | T-05-02 | PATCH `/api/leads/[id]/status` rejects cross-tenant / ungranted-agency requests | unit | `npx vitest run tests/unit/leads-status-route.test.ts` | yes, 0 `it.todo()` remaining (extended, mock updated for `getClaims()` post-fix) | ✅ covered |
| Plan 01 Task 2 (scaffold) → Plan 05 Task 2 (real assertions) | 01, 05 | 1, 3 | AGENCY-01/02 | — | `lib/actions/agencies.ts` create/grant/revoke Server Actions behave correctly | unit | `npx vitest run tests/agencies.test.ts` | yes, 0 `it.todo()` remaining | ✅ covered |
| Plan 01 Task 1 (scaffold) → Plan 02 Task 2 (real assertions) | 01, 02 | 1, 2 | AGENCY-03/04 | — | Agency-scoped tenant list resolution returns correct set | integration | `npx vitest run tests/agency-rls.test.ts` | yes, 0 `it.todo()` remaining | ✅ covered |

*Confirmed 2026-07-10: all 4 Wave 0 test files exist with zero remaining `it.todo()` scaffolds (`grep -c "it.todo(" ` = 0 in each), and the full suite (148 tests, 18 files) passes green — verified independently in Plan 09's Task 1, again during the `/gsd-debug` fix (`agency-app-metadata-getuser-mismatch`), and again by the `/gsd-secure-phase 05` security audit.*

---

## Wave 0 Requirements

- [x] `tests/agency-rls.test.ts` — covers AGENCY-06, AGENCY-03/04 (skip-if-no-env pattern copied from `tests/rls.test.ts`)
- [x] `tests/integration/tenant-role-migration.test.ts` — covers AGENCY-07
- [x] `tests/agencies.test.ts` — covers AGENCY-01/02 (mock pattern copied from `tests/tenants.test.ts`)
- [x] Extend `tests/unit/leads-status-route.test.ts` with cross-tenant/cross-agency 403 cases — covers AGENCY-08 (no new file, no framework install needed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Result |
|----------|-------------|------------|--------------------|--------|
| Agency user post-login routing to client-selector landing | AGENCY-03 | `proxy.ts` redirect branches are not covered by the project's route-handler/mock test style | Log in as a seeded agency user; confirm redirect to the new landing route (not `/login?error=no_membership`) | ✅ Done 2026-07-10 — Plan 09 Task 2 (Script 2), live via Playwright against the real Supabase project. First pass found a redirect-loop bug (`getUser().app_metadata` mismatch); fixed via `/gsd-debug`; re-verified passing |
| Sidebar hides AI Insights/Configurações for `role === 'agency'` | Derived from D-01 | Component rendering tests aren't set up in this project (no `@testing-library/react`, `environment: 'node'`) | Manual UAT: log in as agency user, open a granted tenant, confirm sidebar shows only Dashboard/Campanhas/Gestão de Leads | ✅ Done 2026-07-10 — Plan 09 Task 2 (Script 3). Same bug/fix as above; re-verified passing post-fix |
| Supabase Dashboard → Auth Hooks reselection smoke-test after Custom Access Token Hook migration | AGENCY-06 | Hook selection state lives outside the migration file (Supabase Dashboard config), not verifiable by an automated test | After applying the hook migration, log in as super_admin/tenant/agency users and confirm each JWT has the expected `role`/`tenant_id`/`agency_id` claims | ✅ Done 2026-07-10 — Plan 09 Task 2 (Script 7), user confirmed directly in Supabase Dashboard that `public.custom_access_token_hook` is still selected |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (confirmed by gsd-plan-checker across all 9 PLAN.md)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01, Wave 1, scaffolds all 4 test files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] All 3 Manual-Only Verifications executed live (Plan 09 Task 2) and passed post-fix
- [x] All 5 mapped requirements' test files confirmed COVERED (0 gaps found in this audit — no test generation needed)

**Approval:** plan-checker verification passed (0 blockers) on 2026-07-05 — executed, tested, and validated. Phase 5 is Nyquist-compliant with zero coverage gaps as of 2026-07-10.

---

## Validation Audit 2026-07-10

| Metric | Count |
|--------|-------|
| Requirements checked | 5 |
| Gaps found | 0 |
| Resolved | 0 (none needed) |
| Escalated | 0 |
| Manual-Only items executed | 3/3 |

No new test files generated — all Wave 0 scaffolds were already filled in with real, passing assertions by their implementing plans (02, 03, 05, 08), confirmed via direct filesystem check (`it.todo()` count = 0 in all 4 files) rather than re-deriving coverage from scratch.
