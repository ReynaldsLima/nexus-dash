---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured — Wave 0 installs Vitest |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npm run lint` (per-task) |
| **Full suite command** | `npm test` (per-wave) |
| **Estimated runtime** | ~15 seconds (unit + lint) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm test` + manual smoke (login/logout flow)
- **Before `/gsd-verify-work`:** Full suite green + manual verification of all 5 phase success criteria
- **Max feedback latency:** ~15 seconds (automated); ~5 minutes (manual smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-03 | T-01-01 | Tenant data isolated at DB layer | Integration | `npm test -- --testPathPattern=tenants` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-05 | T-01-02 | Viewer blocked from admin routes | Unit | `npm test -- --testPathPattern=middleware` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-06 | T-01-03 | Cross-tenant RLS returns 0 rows | Integration | `npm test -- --testPathPattern=rls` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-01 | — | Session persists across browser sessions | Manual | Manual — browser test | N/A | ⬜ pending |
| 1-01-05 | 01 | 1 | AUTH-02 | — | Logout invalidates session immediately | Manual | Manual — browser test | N/A | ⬜ pending |
| 1-01-06 | 01 | 1 | AUTH-04 | — | Tenant switcher navigates without logout | Manual | Manual — browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — configure Vitest for unit tests
- [ ] `tests/setup.ts` — test environment setup (Supabase test project connection, test user fixtures)
- [ ] `tests/middleware.test.ts` — unit test middleware route guards with mocked JWT payloads (covers AUTH-05)
- [ ] `tests/rls.test.ts` — RLS isolation test using two test tenant users querying each other's rows (covers AUTH-06)
- [ ] `tests/tenants.test.ts` — Server Action tests for tenant CRUD (create, deactivate) (covers AUTH-03)
- [ ] Framework install: `npm install -D vitest @vitest/ui`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login persists across browser sessions | AUTH-01 | Requires real browser session (httpOnly cookie) | Log in, close tab, reopen → should still be authenticated |
| Logout invalidates session on all pages | AUTH-02 | Requires real browser + session state | Log in on two tabs, logout on one → second tab shows logged out |
| Tenant switcher navigates without logout | AUTH-04 | Requires Super Admin role + multi-tenant setup | Log in as super_admin → switch tenant → URL changes → no logout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (automated)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
