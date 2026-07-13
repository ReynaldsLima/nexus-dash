---
phase: 10-gest-o-de-usu-rios
verified: 2026-07-13T18:55:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 10: Gestão de Usuários Verification Report

**Phase Goal:** Super Admin can manage users (list, edit email, reset password, remove access) for both tenants and agencies, with immediate session revocation on removal — requirements USER-01 through USER-05.
**Verified:** 2026-07-13T18:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Super Admin vê a lista de usuários de um tenant em `/tenants/[slug]`, substituindo o placeholder (USER-01) | ✓ VERIFIED | `app/tenants/[slug]/page.tsx` imports `listTenantUsers`/`UsersTable`, renders `<UsersTable users={users} scope={{ type: 'tenant', ... }} />`; placeholder string absent (grep returns 0 matches); live-verified in 10-04-SUMMARY step 1 against production (`/tenants/beta-test`) |
| 2 | Super Admin vê a lista de usuários de uma agência em `/agencies/[id]`, substituindo o placeholder (USER-02) | ✓ VERIFIED | `app/agencies/[id]/page.tsx` mirrors the tenant wiring (`listAgencyUsers`, `UsersTable`); live-verified in 10-04-SUMMARY step 2 (VIROMIDIA agency) |
| 3 | Super Admin edita o email de um usuário existente e a mudança aparece refletida na listagem (USER-03) | ✓ VERIFIED | `editTenantUserEmail`/`editAgencyUserEmail` in `lib/actions/tenants.ts`/`agencies.ts` call `admin.updateUserById(userId, { email, email_confirm: true })`, gated by `requireSuperAdmin()`, `revalidatePath` on success; unit tests pass (16/16); live-verified in 10-04-SUMMARY step 4 (email changed, toast shown, listing updated) |
| 4 | Super Admin reseta a senha de um usuário existente a partir da própria tela de gestão (USER-04) | ✓ VERIFIED | `resetTenantUserPassword`/`resetAgencyUserPassword` generate a >=16-char temp password via `admin.updateUserById`, gated, tested; live-verified step 5 (20-char temp password shown once with working copy button, re-confirmed with 3 distinct passwords after a dialog-state bug fix) |
| 5 | Super Admin remove o acesso de um usuário (soft-delete, conta preservada) e a sessão é revogada imediatamente, sem depender da expiração natural do token (USER-05) | ✓ VERIFIED | Migration `supabase/migrations/0023_revoke_user_sessions_function.sql` creates `SECURITY DEFINER public.revoke_user_sessions(uuid)`, `REVOKE ALL FROM authenticated/anon/PUBLIC`, `GRANT EXECUTE TO service_role` — confirmed live via catalog query (10-01-SUMMARY). `removeTenantUserAccess`/`removeAgencyUserAccess` delete the scoped join row (`.eq('tenant_id'/'agency_id', ...).eq('user_id', ...)`) then call the RPC. Live integration test (`tests/integration/user-session-revocation.test.ts`) proves a pre-revocation refresh token can no longer mint a new access token — passed (2/2) against the real project. Production live-check (10-04-SUMMARY step 6-7) empirically confirmed the access token gets `403 session_not_found` and refresh token `400 refresh_token_not_found` immediately after removal — stronger than the literal `signOut('global')` SC wording (which is technically impossible for a Super Admin to call on another user's JWT, as documented in 10-01-PLAN's objective); the RPC-based mechanism achieves the same immediate-revocation intent and was empirically validated |

**Score:** 5/5 truths verified

### Supporting truth: Authorization gate on all sensitive mutations

The code review (`10-REVIEW.md`) found a **critical** gap (CR-01): the pre-existing tenant/agency mutation actions (`createTenant`, `deactivateTenant`/`reactivateTenant`, `createTenantUser`, `createAgency`, `deactivateAgency`/`reactivateAgency`, `createAgencyUser`, `grantTenant`, `revokeTenant`) had no `requireSuperAdmin()` gate, meaning any authenticated user could invoke them directly as Server Actions, bypassing the route-level guard. This was fixed in commit `09101a0` ("fix(10): require super_admin on all tenant/agency mutation Server Actions"), which is the current HEAD of both files. Verified directly by reading `lib/actions/tenants.ts` and `lib/actions/agencies.ts`: every exported mutation (11 across both files) now starts with `const gate = await requireSuperAdmin(); if ('error' in gate) return gate`. Live-verified in 10-04-SUMMARY step 8 (a `tenant_admin` test user was blocked at both the route-guard and Server-Action-gate layers).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0023_revoke_user_sessions_function.sql` | SECURITY DEFINER RPC, service_role-only | ✓ VERIFIED | Contains `CREATE OR REPLACE FUNCTION public.revoke_user_sessions`, `SECURITY DEFINER`, `REVOKE ALL ... FROM authenticated, anon, PUBLIC`, `GRANT EXECUTE ... TO service_role`; confirmed live via `pg_proc`/`has_function_privilege` per 10-01-SUMMARY |
| `lib/actions/auth-guard.ts` | `requireSuperAdmin()` gate | ✓ VERIFIED | Uses user-session `createClient()` + `rpc('get_user_role')`, never the service client; returns `{error}` for unauthenticated/non-super_admin |
| `lib/actions/tenants.ts` | `editTenantUserEmail`, `resetTenantUserPassword`, `removeTenantUserAccess` | ✓ VERIFIED & WIRED | All three exported, gated, doubly-scoped delete (`tenant_id`+`user_id`) before RPC call; used by `components/users/*` dialogs |
| `lib/actions/agencies.ts` | `editAgencyUserEmail`, `resetAgencyUserPassword`, `removeAgencyUserAccess` | ✓ VERIFIED & WIRED | Mirrors tenant actions, scoped by `agency_id`+`user_id` |
| `lib/users.ts` | `listTenantUsers`/`listAgencyUsers` read path | ✓ VERIFIED & WIRED | Join-row query + per-row `admin.getUserById`; imported and called from both pages |
| `components/users/users-table.tsx` | Email + actions table (2 columns only) | ✓ VERIFIED & WIRED | Exactly 2 `<TableHead>` (E-mail, Ações); no last-login/linked-date columns |
| `components/users/user-row-actions.tsx` | ⋮ dropdown mounting 3 dialogs | ✓ VERIFIED & WIRED | 3 `useState` flags, `DropdownMenuItem` per action, mounts `EditUserEmailDialog`/`ResetUserPasswordDialog`/`RemoveUserAccessDialog` |
| `components/users/{edit,reset,remove}-user-*-dialog.tsx` | Controlled Dialog/AlertDialog dispatching by scope | ✓ VERIFIED & WIRED | No `DialogTrigger`/`AlertDialogTrigger`; all three route close events through a shared `handleOpenChange` (dialog-state bug found and fixed live in 10-04, commit `dd9b75d`) |
| `app/tenants/[slug]/page.tsx` / `app/agencies/[id]/page.tsx` | Placeholder replaced with `UsersTable` | ✓ VERIFIED & WIRED | Placeholder string absent; `UsersTable`/`listTenantUsers`/`listAgencyUsers` present |
| `app/tenants/layout.tsx` / `app/agencies/layout.tsx` | `<Toaster/>` mounted | ✓ VERIFIED | Both mount `Toaster` (needed for the removal toast) |
| `tests/integration/user-session-revocation.test.ts` | Live proof RPC revokes refresh capability | ✓ VERIFIED | Passed 2/2 in current `npm test` run |
| `tests/unit/tenant-user-management-actions.test.ts` / `agency-user-management-actions.test.ts` | GREEN, no `it.todo` remaining | ✓ VERIFIED | 8/8 + 8/8 passing in current run |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/tenants/[slug]/page.tsx` | `lib/users.ts listTenantUsers` | `await listTenantUsers(tenant.id)` | WIRED | Confirmed in file |
| `app/agencies/[id]/page.tsx` | `lib/users.ts listAgencyUsers` | `await listAgencyUsers(agency.id)` | WIRED | Confirmed in file |
| `components/users/user-row-actions.tsx` | 3 dialogs | `open`/`onOpenChange` props | WIRED | Confirmed |
| `components/users/*-dialog.tsx` | `lib/actions/tenants.ts` + `agencies.ts` | scope-dispatched Server Action call | WIRED | Confirmed in each dialog file |
| `lib/actions/tenants.ts removeTenantUserAccess` / `agencies.ts removeAgencyUserAccess` | `public.revoke_user_sessions` | `createServiceClient().rpc('revoke_user_sessions', {...})` | WIRED | Confirmed; live-proven by integration test + production check |
| All 11 mutation actions (both files) | `requireSuperAdmin` | called as first statement | WIRED | Confirmed — CR-01 fix present at HEAD (commit `09101a0`) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `UsersTable` (`app/tenants/[slug]/page.tsx`) | `users` | `await listTenantUsers(tenant.id)` → `tenant_users` join + `admin.getUserById` | Yes — real Supabase Auth query, no static fallback | ✓ FLOWING |
| `UsersTable` (`app/agencies/[id]/page.tsx`) | `users` | `await listAgencyUsers(agency.id)` → `agency_users` join + `admin.getUserById` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green (Phase 10 files) | `npx vitest run tests/unit/tenant-user-management-actions.test.ts tests/unit/agency-user-management-actions.test.ts` | 16/16 passed | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Only the 2 documented pre-existing `vault-rpc.test.ts` errors | ✓ PASS |
| Full suite regression check | `npm test` | 248 passed / 1 skipped / 5 todo; 1 failure (`anomaly-alerts-schema.test.ts` realtime subscription) | ⚠️ documented pre-existing flake |
| Flake isolation re-run | `npx vitest run tests/unit/anomaly-alerts-schema.test.ts` | 7/7 passed in isolation | ✓ CONFIRMED non-regression |
| `revoke_user_sessions` RPC present in generated types | `grep revoke_user_sessions types/database.types.ts` | Found at line 487 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| USER-01 | 10-03 (+10-04 live-verify) | List tenant users on `/tenants/[slug]` | ✓ SATISFIED | Wired + live-verified |
| USER-02 | 10-03 (+10-04 live-verify) | List agency users on `/agencies/[id]` | ✓ SATISFIED | Wired + live-verified |
| USER-03 | 10-02 (+10-04 live-verify) | Edit user email | ✓ SATISFIED | Action + UI + live-verified |
| USER-04 | 10-02 (+10-04 live-verify) | Reset user password | ✓ SATISFIED | Action + UI + live-verified |
| USER-05 | 10-01, 10-02 (+10-04 live-verify) | Remove access + immediate session revocation | ✓ SATISFIED | RPC + action + integration test + live-verified |

No orphaned requirements: REQUIREMENTS.md's Phase 10 traceability row set (USER-01..05) matches exactly the union of `requirements:` fields declared across all four plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/actions/tenants.ts` / `agencies.ts` | `removeTenantUserAccess`/`removeAgencyUserAccess` | `revalidatePath` only called after the `revoke_user_sessions` RPC succeeds; if the RPC errors after a successful join-row delete, the UI is not revalidated even though access was already removed (review WR-01) | ⚠️ Warning | Rare edge case (delete succeeds, RPC call fails) — access is actually removed but UI may show a stale row until an unrelated navigation. Does not block the phase goal's success path (both operations succeed together in all tested/live-verified cases). Still present in current code — not yet fixed. |
| `lib/actions/tenants.ts` / `agencies.ts` | `editTenantUserEmail`/`resetTenantUserPassword` (+ agency equivalents) | No membership check that `userId` actually belongs to the given `tenantId`/`agencyId` before mutating (review WR-02) | ⚠️ Warning | Only `super_admin` can reach these actions (post CR-01 fix); a tampered request could theoretically edit/reset a user unrelated to the tenant shown in the UI. Low real-world risk given the trusted single-actor threat model documented in the phase's own threat register. Still present — not yet fixed. |

Neither warning is a blocker: both were classified as `warning`, not `critical`, by the phase's own code review, and neither prevents any of the 5 roadmap Success Criteria from being true. The one `critical` finding (CR-01) has been verified fixed in the current codebase (commit `09101a0`, confirmed by direct code read).

### Human Verification Required

None outstanding. Plan 04 executed the human-verification checkpoint required by this phase's own validation strategy (10-VALIDATION.md — `@testing-library/react` not installed, so dropdown/dialog/toast interaction and D-05 are manual-only). The checkpoint was carried out against Vercel production with concrete, falsifiable evidence (HTTP status codes from direct Supabase Auth REST calls, specific commit hashes, before/after listing observations) rather than a vague "looks good" claim, and it uncovered and fixed a real bug (stale dialog state, commit `dd9b75d`) — the kind of finding this verifier would otherwise ask a human to check for. No further live re-testing is warranted for this verification pass.

### Gaps Summary

No gaps. All 5 roadmap Success Criteria (USER-01 through USER-05) are verified present in code, wired end-to-end, covered by passing automated tests, and independently live-verified against production with concrete evidence. The one critical security finding from code review (CR-01 — missing `requireSuperAdmin()` gate on pre-existing tenant/agency mutations) has been fixed and confirmed present at HEAD. Two non-blocking warnings (WR-01, WR-02) remain open in the code review but do not affect goal achievement — they are noted here for visibility/future cleanup, not as phase-blocking gaps.

---

_Verified: 2026-07-13T18:55:00Z_
_Verifier: Claude (gsd-verifier)_
