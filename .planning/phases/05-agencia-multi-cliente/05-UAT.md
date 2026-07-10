---
status: complete
phase: 05-agencia-multi-cliente
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md, 05-08-SUMMARY.md, 05-09-SUMMARY.md]
started: 2026-07-10T21:47:25Z
updated: 2026-07-10T21:53:00Z
note: |
  Auto-populated from this session's own live Playwright verification (Plan 09 Task 2,
  first pass + post-fix re-verification pass) rather than a fresh manual click-through —
  every test below was already driven end-to-end against the real app (npm run dev) and
  the real Supabase project (rvkkvjitfddtbdpkupok) earlier in this same conversation.
  Presenting consolidated results for final user sign-off instead of repeating identical
  clicks.
---

## Current Test

[testing complete — user confirmed all 9 results as final]

## Tests

### 1. Super Admin creates an agency, adds a user, grants a tenant (AGENCY-01/AGENCY-02)
expected: On `/agencies`, Super Admin can create a new agency, add a user (temp password shown once), and check a tenant in "Clientes vinculados" — the grant persists across a page reload.
result: pass

### 2. Agency user lands on `/agencia` after login and sees only granted tenants (AGENCY-03)
expected: Logging in as an agency user redirects to `/agencia` (not `/login?error=no_membership`), showing "Meus clientes" with exactly the tenant(s) granted to that agency — and the page stays stable on repeat navigation/reload (no redirect loop).
result: pass

### 3. Agency user enters a granted tenant and sees a scoped sidebar (AGENCY-04)
expected: Clicking into a granted tenant loads its dashboard normally; the sidebar hides "AI Insights" and "Conta" (Configurações); the header switcher shows only granted tenants and its "Gerenciar clientes…" link routes to `/agencia`.
result: pass

### 4. Agency user edits a lead's status for a granted tenant (AGENCY-05)
expected: On "Gestão de Leads" for a granted tenant, changing a lead's status dropdown saves successfully (200, no 403) and the change persists after reload.
result: pass

### 5. Agency user is blocked from a non-granted tenant's data (AGENCY-06/AGENCY-08)
expected: Navigating directly to a non-granted tenant's URL never exposes that tenant's data, and results in a clean redirect (not an error page or infinite loop).
result: pass

### 6. Cliente (tenant_admin) retains full, unrestricted access (AGENCY-07)
expected: A tenant_admin user sees the full sidebar (including AI Insights and Conta) and can edit lead status successfully (200, no 403) — the Agência module introduces no regression for existing Cliente accounts.
result: pass

### 7. Custom Access Token Hook still active in Supabase (infra smoke test)
expected: In Supabase Dashboard → Authentication → Hooks → Custom Access Token, `public.custom_access_token_hook` is still the selected hook after migrations 0019/0020.
result: pass

### 8. Super Admin manages agencies via `/agencies` list + detail (AGENCY-01/AGENCY-02)
expected: `/agencies` lists all agencies with name/status/actions; `/agencies/[id]` shows Informações, Usuários, and Clientes vinculados sections, mirroring the `/tenants` structure.
result: pass

### 9. Full automated suite stays green across all 8 merged plans
expected: `npm test` (148 passed), `npx tsc --noEmit` (only 2 pre-existing unrelated errors), and `npm run build` all succeed with every Phase 5 plan's changes merged, and the dev server survives repeated hot-reloads/restarts across the whole session without crashing.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
