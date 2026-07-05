---
phase: 5
slug: agencia-multi-cliente
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05
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
| Plan 01 Task 1 (scaffold) → Plan 02 Task 2 (real assertions) | 01, 02 | 1, 2 | AGENCY-06 | T-05-01 | Agency-scoped RLS returns only granted tenants' rows | integration | `npx vitest run tests/agency-rls.test.ts` | pending execution | ⬜ pending |
| Plan 01 Task 1 (scaffold) → Plan 03 Task 1 (real assertions) | 01, 03 | 1, 3 | AGENCY-07 | — | `tenant_users.role` collapse leaves no row outside `('tenant_admin')` | integration | `npx vitest run tests/integration/tenant-role-migration.test.ts` | pending execution | ⬜ pending |
| Plan 01 Task 2 (scaffold) → Plan 08 Task 2 (real assertions) | 01, 08 | 1, 3 | AGENCY-08 | T-05-02 | PATCH `/api/leads/[id]/status` rejects cross-tenant / ungranted-agency requests | unit | `npx vitest run tests/unit/leads-status-route.test.ts` | pending execution (extends existing file) | ⬜ pending |
| Plan 01 Task 2 (scaffold) → Plan 05 Task 2 (real assertions) | 01, 05 | 1, 3 | AGENCY-01/02 | — | `lib/actions/agencies.ts` create/grant/revoke Server Actions behave correctly | unit | `npx vitest run tests/agencies.test.ts` | pending execution | ⬜ pending |
| Plan 01 Task 1 (scaffold) → Plan 02 Task 2 (real assertions) | 01, 02 | 1, 2 | AGENCY-03/04 | — | Agency-scoped tenant list resolution returns correct set | integration | `npx vitest run tests/agency-rls.test.ts` | pending execution | ⬜ pending |

*Task ID / Plan / Wave columns filled in after `/gsd-plan-phase 5` produced the 9 finalized PLAN.md files (plan-checker pass, 2026-07-05). Each requirement's test file is scaffolded with `it.todo()` in Plan 01 (Wave 1) and filled with real assertions by the plan that implements the corresponding behavior. "File Exists"/"Status" columns will be updated to reflect actual state once `/gsd-execute-phase 5` runs.*

---

## Wave 0 Requirements

- [ ] `tests/agency-rls.test.ts` — covers AGENCY-06, AGENCY-03/04 (skip-if-no-env pattern copied from `tests/rls.test.ts`)
- [ ] `tests/integration/tenant-role-migration.test.ts` — covers AGENCY-07
- [ ] `tests/agencies.test.ts` — covers AGENCY-01/02 (mock pattern copied from `tests/tenants.test.ts`)
- [ ] Extend `tests/unit/leads-status-route.test.ts` with cross-tenant/cross-agency 403 cases — covers AGENCY-08 (no new file, no framework install needed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Agency user post-login routing to client-selector landing | AGENCY-03 | `proxy.ts` redirect branches are not covered by the project's route-handler/mock test style | Log in as a seeded agency user; confirm redirect to the new landing route (not `/login?error=no_membership`) |
| Sidebar hides AI Insights/Configurações for `role === 'agency'` | Derived from D-01 | Component rendering tests aren't set up in this project (no `@testing-library/react`, `environment: 'node'`) | Manual UAT: log in as agency user, open a granted tenant, confirm sidebar shows only Dashboard/Campanhas/Gestão de Leads |
| Supabase Dashboard → Auth Hooks reselection smoke-test after Custom Access Token Hook migration | AGENCY-06 | Hook selection state lives outside the migration file (Supabase Dashboard config), not verifiable by an automated test | After applying the hook migration, log in as super_admin/tenant/agency users and confirm each JWT has the expected `role`/`tenant_id`/`agency_id` claims |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (confirmed by gsd-plan-checker across all 9 PLAN.md)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01, Wave 1, scaffolds all 4 test files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plan-checker verification passed (0 blockers) on 2026-07-05 — ready for `/gsd-execute-phase 5`
