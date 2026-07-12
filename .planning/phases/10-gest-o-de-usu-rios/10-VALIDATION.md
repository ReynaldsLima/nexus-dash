---
phase: 10
slug: gest-o-de-usu-rios
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 |
| **Config file** | `vitest.config.ts` (environment: node, setupFiles: `tests/setup.ts`) |
| **Quick run command** | `npx vitest run tests/unit/tenant-user-management-actions.test.ts tests/unit/agency-user-management-actions.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds (unit), integration test skip-if-no-env |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/tenant-user-management-actions.test.ts tests/unit/agency-user-management-actions.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | — | — | New migration `revoke_user_sessions` RPC restricted to `service_role` only | manual (`\d auth.sessions`) | `supabase db query "\d auth.sessions" "\d auth.refresh_tokens"` | ❌ W0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | USER-01 | — | Tenant users list renders (email + actions, no extra fields) | manual-only | Playwright MCP: navigate `/tenants/[slug]` | ❌ W0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | USER-02 | — | Agency users list renders | manual-only | Playwright MCP: navigate `/agencies/[id]` | ❌ W0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | USER-03 | T-10-01 | `editTenantUserEmail`/`editAgencyUserEmail` call `admin.updateUserById` with `email_confirm:true`; reject non-super_admin caller | unit | `npx vitest run tests/unit/tenant-user-management-actions.test.ts` | ❌ W0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | USER-04 | T-10-01 | `resetTenantUserPassword`/`resetAgencyUserPassword` call `admin.updateUserById` with generated password; reject non-super_admin caller | unit | same file as USER-03 | ❌ W0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | USER-05 | T-10-02 | `removeTenantUserAccess`/`removeAgencyUserAccess` delete scoped join row (tenant_id+user_id) AND call `revoke_user_sessions` RPC; reject non-super_admin caller | unit | same file as USER-03 | ❌ W0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | USER-05 (revocation actually takes effect) | T-10-02 | Pre-revocation refresh token can no longer mint a new access token after `revoke_user_sessions` | integration (skip-if-no-env) | `npx vitest run tests/integration/user-session-revocation.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/0023_revoke_user_sessions_function.sql` — new SECURITY DEFINER RPC, does not exist yet; required for USER-05
- [ ] `supabase db query "\d auth.sessions" "\d auth.refresh_tokens"` — confirm cascade FK before relying on `DELETE FROM auth.sessions` alone (Open Question 2 in RESEARCH.md)
- [ ] `tests/unit/tenant-user-management-actions.test.ts` — mock-based, mirrors `tests/agencies.test.ts` shape
- [ ] `tests/unit/agency-user-management-actions.test.ts` — same, agency-scoped
- [ ] `tests/integration/user-session-revocation.test.ts` — skip-if-no-env, mirrors `tests/agency-rls.test.ts` pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Tenant/agency users table renders with dropdown actions | USER-01, USER-02 | No component-rendering test tooling (`@testing-library/react` not installed); Server Component read path | Playwright MCP against Vercel prod: navigate `/tenants/[slug]` and `/agencies/[id]`, assert table rows show email + actions column only |
| Dropdown opens correct Dialog per row; table refreshes + toast appears after removal | USER-01–USER-05, D-09 | First real consumer of `dropdown-menu.tsx` (never rendered in this app before) — no prior production exposure, Base UI Menu/Dialog interaction can only be confirmed live | Playwright MCP: open dropdown, click each action, confirm Dialog opens without focus/portal issues; after remove-access confirm, assert row disappears and toast "Acesso removido e sessão encerrada" appears |
| Non-super_admin session cannot reach edit/reset/remove actions | V4 Access Control | Requires a real second session with a non-super_admin role to attempt the Server Actions | Manual: sign in as tenant_admin/viewer, confirm UI does not expose the actions OR the Server Action returns the auth-gate error |
| D-05 assumption: does password reset actually leave the session untouched on THIS project's hosted Supabase instance | USER-04, D-05/D-07 | Documented hosted-GoTrue behavior contradicts D-05's premise (RESEARCH.md Critical Finding) — must be checked against this project's live Auth server, not assumed | Manual: reset a live test user's password, then attempt an authenticated request with their pre-existing session token; confirm whether it still works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
