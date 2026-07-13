---
phase: 10-gest-o-de-usu-rios
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - app/agencies/[id]/page.tsx
  - app/agencies/layout.tsx
  - app/tenants/[slug]/page.tsx
  - app/tenants/layout.tsx
  - components/users/edit-user-email-dialog.tsx
  - components/users/remove-user-access-dialog.tsx
  - components/users/reset-user-password-dialog.tsx
  - components/users/user-row-actions.tsx
  - components/users/user-scope.ts
  - components/users/users-table.tsx
  - lib/actions/agencies.ts
  - lib/actions/auth-guard.ts
  - lib/actions/tenants.ts
  - lib/users.ts
  - supabase/migrations/0023_revoke_user_sessions_function.sql
  - tests/integration/user-session-revocation.test.ts
  - tests/unit/agency-user-management-actions.test.ts
  - tests/unit/tenant-user-management-actions.test.ts
  - types/database.types.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the Phase 10 user-management feature: the three action-menu dialogs (edit email, reset
password, remove access), the `UserRowActions`/`UsersTable`/`user-scope` supporting components,
the tenant/agency Server Actions, the new `requireSuperAdmin()` guard, the `revoke_user_sessions`
migration, and the associated tests/types.

The new USER-03/04/05 actions (`edit*UserEmail`, `reset*UserPassword`, `remove*UserAccess`) are
correctly gated with `requireSuperAdmin()`, and `revoke_user_sessions` is a well-scoped
`SECURITY DEFINER` function with `search_path` pinned and `EXECUTE` revoked from everyone except
`service_role` — good practice. Unit and integration test coverage for the new actions and the
session-revocation RPC is solid (the integration test actually proves server-side effect via a
real refresh-token exchange, not just "RPC didn't throw").

However, reviewing `lib/actions/tenants.ts` and `lib/actions/agencies.ts` in full (not just the
new functions) surfaced a critical authorization gap in the **pre-existing** actions in the same
files: `createTenant`, `deactivateTenant`/`reactivateTenant`, `createTenantUser`, `createAgency`,
`deactivateAgency`/`reactivateAgency`, `createAgencyUser`, `grantTenant`, and `revokeTenant` do
**not** call `requireSuperAdmin()` at all, unlike every action added in this phase. Since these
are Server Actions (directly invokable regardless of which page rendered them) and there is no
`middleware.ts` in the repo enforcing role checks at the route level, any authenticated user —
regardless of role — can currently invoke these mutations directly. This stands out precisely
because Phase 10 introduced the "re-verify inside every sensitive Server Action" pattern
(`lib/actions/auth-guard.ts` docstring) but didn't retrofit it to the older actions living in the
same files that were touched this phase.

Also re-reviewed the three dialogs specifically for the stale-state class of bug that was already
found and fixed in production. `reset-user-password-dialog.tsx` and `remove-user-access-dialog.tsx`
now consistently funnel every close path through a single named `handleOpenChange` function.
`edit-user-email-dialog.tsx`, however, still duplicates the reset-on-close logic between the
`Dialog`'s inline `onOpenChange` and the Cancel button's `onClick` instead of using one shared
function — functionally equivalent today, but exactly the pattern that produced the original bug
if another piece of local state is added later without remembering to update both places.

## Critical Issues

### CR-01: Sensitive tenant/agency mutations lack the super_admin authorization gate

**File:** `lib/actions/tenants.ts:56-155`, `lib/actions/agencies.ts:50-178`
**Issue:**
`createTenant`, `setTenantActive` (used by `deactivateTenant`/`reactivateTenant`),
`createTenantUser`, `createAgency`, `setAgencyActive` (used by
`deactivateAgency`/`reactivateAgency`), `createAgencyUser`, `grantTenant`, and `revokeTenant` all
use `createServiceClient()` (service-role key, bypasses RLS entirely — see
`lib/supabase/service.ts`) with **no call to `requireSuperAdmin()`**. Contrast with every
action added in this phase (`editTenantUserEmail`, `resetTenantUserPassword`,
`removeTenantUserAccess`, and their agency equivalents), which all start with:
```ts
const gate = await requireSuperAdmin()
if ('error' in gate) return gate
```
There is no `middleware.ts` in the repo restricting Server Action invocation by role — the
`app/tenants/layout.tsx` / `app/agencies/layout.tsx` redirect only protects page *rendering*, not
the action endpoints themselves, which Next.js exposes independently of which page they were
imported from. Any authenticated user (e.g. a `tenant_admin` or `viewer`) can currently call
`createTenant`, `deactivateTenant`, `grantTenant`, `createAgencyUser`, etc. directly, bypassing the
UI entirely — a privilege-escalation / tenant-isolation violation, which directly contradicts the
project's non-negotiable constraint ("Segurança: Row Level Security no Supabase obrigatório —
isolamento total entre tenants", `CLAUDE.md`).
**Fix:**
```ts
export async function createTenant(input: { name: string; slug: string }): Promise<CreateTenantResult> {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate

  const parsed = createTenantSchema.safeParse(input)
  // ...
}
```
Apply the same guard to `setTenantActive`, `createTenantUser`, `createAgency`,
`setAgencyActive`, `createAgencyUser`, `grantTenant`, and `revokeTenant`.

## Warnings

### WR-01: Partial failure in remove-access actions leaves UI out of sync

**File:** `lib/actions/tenants.ts:216-245`, `lib/actions/agencies.ts:236-265`
**Issue:** `removeTenantUserAccess`/`removeAgencyUserAccess` first `DELETE` the
`tenant_users`/`agency_users` row, then call the `revoke_user_sessions` RPC. If the delete
succeeds but the RPC fails, the function returns `{ error: rpcError.message }` **without** calling
`revalidatePath`. The access row has already been removed from the database, but the dialog shows
a raw Postgres error and stays open, and the users table is never revalidated — so the admin sees
an "error" for an operation that (mostly) succeeded, and the stale row keeps showing in the UI
until an unrelated navigation triggers a refetch.
**Fix:**
```ts
const { error } = await supabase.from('tenant_users').delete()
  .eq('tenant_id', parsed.data.tenantId).eq('user_id', parsed.data.userId)
if (error) return { error: error.message }

revalidatePath(`/tenants/${parsed.data.tenantId}`) // revalidate regardless of RPC outcome below

const { error: rpcError } = await supabase.rpc('revoke_user_sessions', {
  target_user_id: parsed.data.userId,
})
if (rpcError) return { error: rpcError.message }

return { ok: true }
```

### WR-02: Edit/reset actions mutate a user by ID with no membership check against the given tenant/agency

**File:** `lib/actions/tenants.ts:160-214`, `lib/actions/agencies.ts:180-234`
**Issue:** `editTenantUserEmail` / `resetTenantUserPassword` / `editAgencyUserEmail` /
`resetAgencyUserPassword` all accept `userId` and `tenantId`/`agencyId` from the client, but only
use `tenantId`/`agencyId` for `revalidatePath` — the actual mutation
(`supabase.auth.admin.updateUserById(userId, ...)`) is performed with no verification that
`userId` is actually a member of that tenant/agency (unlike `removeTenantUserAccess`, whose
`DELETE ... WHERE tenant_id = X AND user_id = Y` is naturally scoped). A tampered client request
(devtools/replay with an arbitrary UUID) would silently edit or reset the password of a user
unrelated to the tenant/agency shown in the UI, with no error returned.
**Fix:** Verify membership before mutating, e.g.:
```ts
const { data: link } = await supabase
  .from('tenant_users')
  .select('user_id')
  .eq('tenant_id', parsed.data.tenantId)
  .eq('user_id', parsed.data.userId)
  .maybeSingle()
if (!link) return { error: 'Usuário não pertence a este tenant.' }
```

### WR-03: `edit-user-email-dialog.tsx` duplicates the close/reset logic instead of centralizing it

**File:** `components/users/edit-user-email-dialog.tsx:57-78`
**Issue:** The Dialog's `onOpenChange` wraps reset logic inline (`onOpenChange(v); if (!v)
setError(null)`), while the Cancel button separately re-implements the same reset
(`setError(null); onOpenChange(false)`) instead of calling a single named handler. This is exactly
the shape of the bug already found and fixed in `reset-user-password-dialog.tsx` and
`remove-user-access-dialog.tsx`, both of which now route every close path through one
`handleOpenChange` function. It works today only because there is a single piece of local state
(`error`); if another piece of local state is added to this dialog later, it's easy to update one
call site and forget the other, reintroducing the original stale-state bug.
**Fix:**
```ts
function handleOpenChange(v: boolean) {
  onOpenChange(v)
  if (!v) setError(null)
}
// ...
<Dialog open={open} onOpenChange={handleOpenChange}>
  ...
  <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
    Cancelar
  </Button>
```

## Info

### IN-01: `generateTempPassword()` duplicated, and its length is not deterministically guaranteed

**File:** `lib/actions/tenants.ts:47-50`, `lib/actions/agencies.ts:44-46`
**Issue:** The same helper is copy-pasted in both files (extract to a shared module, e.g.
`lib/passwords.ts`). Separately, `randomBytes(12).toString('base64')` yields exactly 16
characters (no padding, since 12 is divisible by 3); stripping `+`, `/`, `=` before `.slice(0, 16)`
means the length is `16 - N` where `N` is however many of those characters occurred, so the final
password length (`20 - N` after the `'Aa1!'` suffix) is only *probabilistically* ≥ 16, not
guaranteed by construction. In practice `N` is small enough that this is very unlikely to bite,
but the unit tests' `expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)` assertion is
technically asserting a property the algorithm doesn't guarantee.
**Fix:** Generate a few extra bytes up front (e.g. `randomBytes(16)`) and slice to a fixed length
*after* stripping unwanted characters, or use a base64url/alphanumeric-only encoding so no
characters need to be stripped.

### IN-02: Error messages from Supabase/Postgres are surfaced to the UI verbatim

**File:** `lib/actions/tenants.ts:210, 241`, `lib/actions/agencies.ts:230, 261`
**Issue:** `resetTenantUserPassword`/`removeTenantUserAccess` (and agency equivalents) return
`error.message`/`rpcError.message` straight from the database driver in several branches, while
other branches in the same files (e.g. the "already registered" case) take care to map errors to
a friendly Portuguese message. This is a minor consistency gap (audience is super_admin only, so
no real information-disclosure risk) — consider wrapping these too for a uniform UX.

---

_Reviewed: 2026-07-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
