---
phase: 10-gest-o-de-usu-rios
plan: 03
subsystem: ui
tags: [nextjs, base-ui, dropdown-menu, dialog, sonner, server-components]

# Dependency graph
requires:
  - phase: 10-gest-o-de-usu-rios
    plan: 02
    provides: "editTenantUserEmail/resetTenantUserPassword/removeTenantUserAccess + agency equivalents (Server Actions)"
provides:
  - "lib/users.ts: listTenantUsers / listAgencyUsers read path"
  - "components/users/*: UserScope, ManagedUser, UsersTable, UserRowActions, EditUserEmailDialog, ResetUserPasswordDialog, RemoveUserAccessDialog"
  - "Toaster mounted in app/tenants/layout.tsx + app/agencies/layout.tsx"
affects: [10-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scope-parameterized shared UI (UserScope discriminated union) instead of parallel components/tenants/* + components/agencies/* dialog sets — one component set dispatches on scope.type"
    - "Dialogs/AlertDialog fully externally controlled (open/onOpenChange props, no DialogTrigger/AlertDialogTrigger) so they can be opened from a DropdownMenuItem.onClick without focus/portal conflicts"
    - "dropdown-menu.tsx's first real production usage (DropdownMenuTrigger render={<Button/>} prop, DropdownMenuItem variant=\"destructive\")"

key-files:
  created:
    - lib/users.ts
    - components/users/user-scope.ts
    - components/users/edit-user-email-dialog.tsx
    - components/users/reset-user-password-dialog.tsx
    - components/users/remove-user-access-dialog.tsx
    - components/users/user-row-actions.tsx
    - components/users/users-table.tsx
  modified:
    - app/tenants/[slug]/page.tsx
    - app/agencies/[id]/page.tsx
    - app/tenants/layout.tsx
    - app/agencies/layout.tsx

key-decisions:
  - "Consolidated the RESEARCH.md's sketched parallel components/tenants/* + components/agencies/* dialog sets into one scope-parameterized components/users/* set (UserScope), per the plan's explicit note — route already knows its context, avoids ~10 near-duplicate files"
  - "lib/users.ts imports ManagedUser from components/users/user-scope.ts rather than redeclaring it — single source of truth, per the plan's explicit instruction"

patterns-established: []

requirements-completed: [USER-01, USER-02]

duration: ~14min
completed: 2026-07-12
---

# Phase 10 Plan 03: User-Management UI Summary

**Scope-parameterized users table (email + ⋮ dropdown) replacing the "gerenciado via Supabase Dashboard" placeholder on both `/tenants/[slug]` and `/agencies/[id]`, wired to Plan 02's Server Actions via a single `UserScope` discriminated union.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-12T14:20:00Z (approx.)
- **Completed:** 2026-07-12T14:34:00Z (approx.)
- **Tasks:** 3/3 completed
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments

- `components/users/user-scope.ts` exports `UserScope` (tenant/agency discriminated union) and `ManagedUser` — the single shared shape consumed by every new component and `lib/users.ts`
- Three externally-controlled dialogs (`EditUserEmailDialog`, `ResetUserPasswordDialog`, `RemoveUserAccessDialog`) each dispatch to the correct tenant/agency Server Action via `scope.type`, following 10-RESEARCH.md's Pattern 3 (no `DialogTrigger`/`AlertDialogTrigger` nested inside a menu item)
- `UserRowActions` is the first real production consumer of `components/ui/dropdown-menu.tsx` (installed since early in the project, never rendered until now) — three independent `useState` open-flags, `DropdownMenuTrigger render={<Button/>}`, destructive variant on "Remover acesso"
- `UsersTable` renders exactly two columns (E-mail, Ações) per D-03 — no "último login"/"data de vinculação"
- `lib/users.ts` provides the read path: `tenant_users`/`agency_users` join-row query (public client scope) + per-row `service.auth.admin.getUserById()` (service-role, since `auth.users` is unreachable via PostgREST) — returns `[]` on query error rather than throwing, so the page still renders
- Both `/tenants/[slug]` and `/agencies/[id]` now render `<UsersTable>` in place of the placeholder text; `AddUserModal`/`AddAgencyUserModal` kept in their `CardHeader`s
- `Toaster` (dark theme, top-right, matching `app/[tenant-slug]/layout.tsx`'s exact config) mounted in both `app/tenants/layout.tsx` and `app/agencies/layout.tsx` — neither admin layout mounted one before this plan, so D-09's "Acesso removido e sessão encerrada" toast had nowhere to render until now
- Full suite: 32 test files, 249 passed / 1 skipped / 5 todo — zero regressions (this plan added no test files; UI/read-path coverage here is Server-Component/dialog code with no `@testing-library/react` in the project, consistent with 10-RESEARCH.md's Validation Architecture — manual verification deferred to Plan 04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scope type + the three controlled dialog components** - `7433b91` (feat)
2. **Task 2: Users table + row-actions dropdown** - `761f4bb` (feat)
3. **Task 3: Read path + wire both pages + mount Toaster** - `0e793e3` (feat)

## Files Created/Modified

- `components/users/user-scope.ts` - `UserScope` discriminated union + `ManagedUser` interface
- `components/users/edit-user-email-dialog.tsx` - `EditUserEmailDialog`, controlled Dialog, dispatches to `editTenantUserEmail`/`editAgencyUserEmail`
- `components/users/reset-user-password-dialog.tsx` - `ResetUserPasswordDialog`, mirrors `AddUserModal`'s two-state "show password once" UX
- `components/users/remove-user-access-dialog.tsx` - `RemoveUserAccessDialog`, controlled AlertDialog, D-08 (no type-to-confirm) + D-09 exact toast copy
- `components/users/user-row-actions.tsx` - `UserRowActions`, ⋮ dropdown mounting all three dialogs
- `components/users/users-table.tsx` - `UsersTable`, email + actions-only table (D-03), empty-state card
- `lib/users.ts` - `listTenantUsers`/`listAgencyUsers` read path, re-exports `ManagedUser` from `components/users/user-scope.ts`
- `app/tenants/[slug]/page.tsx` - wired `listTenantUsers` + `UsersTable`, placeholder removed
- `app/agencies/[id]/page.tsx` - wired `listAgencyUsers` + `UsersTable`, placeholder removed
- `app/tenants/layout.tsx` - mounted `Toaster`
- `app/agencies/layout.tsx` - mounted `Toaster`

## Decisions Made

- **Single scope-parameterized component set, not parallel tenant/agency dialog sets:** 10-RESEARCH.md sketched `components/tenants/*` and `components/agencies/*` dialog duplicates; this plan consolidates them into `components/users/*` dispatching on `scope.type`, per the plan's own explicit note — the route already knows its context, so no functionality is lost.
- **`ManagedUser` canonical source is `components/users/user-scope.ts`:** `lib/users.ts` imports and re-exports it (`import type { ManagedUser } from '@/components/users/user-scope'; export type { ManagedUser }`) rather than declaring a second, structurally-identical interface — matches the plan's explicit "pick one source of truth" instruction.

## Deviations from Plan

None — plan executed as written. Two acceptance-criteria grep targets in the plan's prose used exact line-count equality (`== 2`, `== 3`) that assumed a particular code layout (e.g., no separate `import` lines naming the same identifiers used later in JSX); the actual line counts came out higher (e.g., `grep -c "DropdownMenuItem"` counts the import line plus each JSX usage line) while still satisfying every criterion's underlying intent (scope dispatches to both, three dialogs mounted, exactly three `DropdownMenuItem` *elements* in the rendered tree). No code changes were needed — this is measurement noise from the grep's literal line-based counting, not a functional gap, and mirrors documented precedent (Phase 05 Plan 07's SUMMARY).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 04 (manual verification, per 10-RESEARCH.md's Validation Architecture) can now: (1) confirm the dropdown opens the correct dialog per row with no focus/portal conflicts, (2) confirm removal makes the row disappear + shows the "Acesso removido e sessão encerrada" toast, (3) live-verify D-05 (whether an existing session survives a password reset) — the one open question 10-RESEARCH.md flagged as needing live confirmation rather than an assumption.
- USER-01/USER-02 are functionally complete (table renders on both admin detail pages); this plan does not mark them in `.planning/REQUIREMENTS.md` frontmatter beyond what the executor's state-update step applies mechanically — no manual override needed, matches this plan's own `requirements:` field.
- No blockers carried forward.

---
*Phase: 10-gest-o-de-usu-rios*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 11 created/modified files verified present on disk; all three task commits (`7433b91`, `761f4bb`, `0e793e3`) verified present in git history via `git log --oneline`.
