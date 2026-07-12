---
phase: 05-agencia-multi-cliente
plan: 06
subsystem: frontend
tags: [nextjs, server-components, server-actions, shadcn, checkbox, agency, super-admin]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 05
    provides: "lib/actions/agencies.ts — createAgency, deactivateAgency, reactivateAgency, createAgencyUser, grantTenant, revokeTenant Server Actions"
provides:
  - "app/agencies/page.tsx + app/agencies/layout.tsx — Super Admin agencies list screen with header nav"
  - "app/agencies/[id]/page.tsx — Super Admin agency detail screen (Informações/Usuários/Clientes vinculados)"
  - "components/agencies/agency-tenant-grants.tsx — optimistic grant/revoke checkbox list, the sole in-app UI entry point for agency_tenants writes"
affects: [05-09-final-verification-uat]

# Tech tracking
tech-stack:
  added:
    - "components/ui/checkbox.tsx (shadcn official registry, @base-ui/react/checkbox)"
  patterns:
    - "Two admin layouts (app/tenants/layout.tsx, app/agencies/layout.tsx) both standardized on (await supabase.auth.getUser()).data.user.app_metadata.role for the super_admin guard, replacing the old manual decodeRole() JWT-decode helper — same server-verified source app/[tenant-slug]/layout.tsx and proxy.ts already use"
    - "Every new agencies/* screen and component is a direct structural copy of its app/tenants/* equivalent (page.tsx, create-*-form.tsx, *-table.tsx, deactivate-*-button.tsx, add-*-user-modal.tsx) — zero new visual language introduced, per 05-UI-SPEC.md's reuse mandate"
    - "agency-tenant-grants.tsx is the only genuinely new component this plan introduces: optimistic Set<string> checkbox state, revert-on-failure via setGranted rollback in the Server Action's error branch, no confirmation dialog (one-row, instantly-reversible action per UI-SPEC's Interaction Contract)"

key-files:
  created:
    - app/agencies/layout.tsx
    - app/agencies/page.tsx
    - "app/agencies/[id]/page.tsx"
    - components/agencies/create-agency-form.tsx
    - components/agencies/agencies-table.tsx
    - components/agencies/deactivate-agency-button.tsx
    - components/agencies/add-agency-user-modal.tsx
    - components/agencies/agency-tenant-grants.tsx
    - components/ui/checkbox.tsx
  modified:
    - app/tenants/layout.tsx
    - .planning/PROJECT.md

key-decisions:
  - "Followed the plan's fully-specified code verbatim for both tasks — no adaptation needed since lib/actions/agencies.ts's signatures (built in Plan 05) matched the plan's snippets exactly"
  - "app/tenants/layout.tsx's decodeRole() manual-JWT-decode helper removed entirely and replaced with user.app_metadata?.role, matching the RESEARCH.md correctness note and app/agencies/layout.tsx's guard — closes a latent inconsistency where /tenants trusted the access_token payload directly while every other admin surface already used the SDK-verified user object"
  - "components/ui/checkbox.tsx installed via npx shadcn add checkbox — resolved to @base-ui/react/checkbox (the package actually installed in this project, ^1.4.1), consistent with dialog.tsx/alert-dialog.tsx's existing Base UI usage"

requirements-completed: [AGENCY-01, AGENCY-02]

# Metrics
duration: ~25min
completed: 2026-07-10
---

# Phase 05 Plan 06: Agency Management UI Summary

**Built the Super Admin's `/agencies` list and `/agencies/[id]` detail screens — the only in-app entry point for creating agencies, adding agency users, and toggling tenant grants — as a one-to-one structural mirror of the existing `/tenants` screens, consuming Plan 05's Server Actions verbatim.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-10 (approx.)
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- `app/agencies/layout.tsx` — new Super-Admin-only layout, role guard via `user.app_metadata.role`, two-link header nav (`Tenants` | `Agências`)
- `app/tenants/layout.tsx` — role guard standardized to the same `app_metadata.role` pattern (removed `decodeRole()` manual JWT decode and the now-unused `supabase.auth.getSession()` call), mirrored two-link nav added with `Tenants` as the active link
- `components/agencies/create-agency-form.tsx` — `CreateTenantForm` mirror, slug field dropped entirely (agencies have no slug), calls `createAgency({ name })`
- `components/agencies/agencies-table.tsx` — `TenantsTable` mirror, Nome is a plain `<span>` (no link), Ações column links to `/agencies/{id}` labeled "Gerenciar"
- `app/agencies/page.tsx` — list screen (Server Component), no `SyncStatusSection` equivalent (tenant-specific)
- Installed `components/ui/checkbox.tsx` via `npx shadcn add checkbox` (official registry, `@base-ui/react/checkbox`)
- `components/agencies/deactivate-agency-button.tsx` — `DeactivateTenantButton` mirror, calls `deactivateAgency`/`reactivateAgency`, agency-specific copy ("Desativar agência?", "A agência... perderão acesso a todos os clientes vinculados imediatamente...")
- `components/agencies/add-agency-user-modal.tsx` — `AddUserModal` mirror (no role select, matching the post-Plan-03 tenant version), calls `createAgencyUser({ email, agencyId })`, identical temp-password success state
- `components/agencies/agency-tenant-grants.tsx` — new client component: bordered checkbox list, optimistic `Set<string>` state, `grantTenant`/`revokeTenant` calls in a `useTransition`, revert-on-failure with inline `role="alert"` error text, alphabetical order (delegated to the page's Supabase query `.order('name')`)
- `app/agencies/[id]/page.tsx` — detail screen with three cards (Informações, Usuários, Clientes vinculados), fetches `agencies`, active `tenants`, and `agency_tenants` grants via the RLS-scoped Server Component client
- `.planning/PROJECT.md` — Out of Scope line for "Roles adicionais..." struck through and marked superseded by Phase 5's Agência module + Cliente role collapse

## Task Commits

Each task was committed atomically:

1. **Task 1: Agencies list screen + Tenants/Agências header nav** - `db7fa18` (feat)
2. **Task 2: Agency detail screen (info, users, tenant grants) + PROJECT.md closure note** - `58926f4` (feat)

## Files Created/Modified

- `app/agencies/layout.tsx` - new Super-Admin layout with two-link header nav
- `app/agencies/page.tsx` - agencies list Server Component page
- `app/agencies/[id]/page.tsx` - agency detail page (three cards)
- `app/tenants/layout.tsx` - role guard standardized, mirrored nav added
- `components/agencies/create-agency-form.tsx` - create-agency dialog form
- `components/agencies/agencies-table.tsx` - agencies list table
- `components/agencies/deactivate-agency-button.tsx` - deactivate/reactivate agency button + confirm dialog
- `components/agencies/add-agency-user-modal.tsx` - add agency user dialog
- `components/agencies/agency-tenant-grants.tsx` - optimistic grant/revoke checkbox list
- `components/ui/checkbox.tsx` - shadcn Checkbox (new dependency, official registry)
- `.planning/PROJECT.md` - Out of Scope section updated

## Decisions Made

- Executed both tasks' fully-specified plan code verbatim — no column-name or signature mismatches between the plan's snippets and `lib/actions/agencies.ts` (confirmed by reading Plan 05's implementation before writing)
- Standardized both admin layouts on `user.app_metadata.role` rather than keeping `app/tenants/layout.tsx`'s pre-existing manual JWT decode, per the plan's explicit instruction and RESEARCH.md's correctness note — this also removes a now-redundant `supabase.auth.getSession()` call
- `npx shadcn add checkbox` resolved against `@base-ui/react` (the package actually present in `package.json`, `^1.4.1`) rather than the UI-SPEC's `@base-ui-components/react` reference — consistent with what `dialog.tsx`/`alert-dialog.tsx` already import, no action needed

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` blocks contained complete, ready-to-use code; the only "difference" from the plan's literal snippets was the Checkbox import path resolving to the package version already installed in this project, which is not a deviation, just confirming an already-correct assumption.

## Issues Encountered

- `npx tsc --noEmit`: only the 2 pre-existing errors in `tests/integration/vault-rpc.test.ts` (lines 124, 135), unrelated to this plan's files, unchanged from Plan 05's SUMMARY.
- `npm run build` (Next.js 16.2.6, Turbopack): completes cleanly; `/agencies` and `/agencies/[id]` both appear as dynamic (`ƒ`) routes in the route table.
- `npx vitest run`: 18 files, 148 passed / 1 skipped / 5 todo (pre-existing elsewhere), zero regressions.

## Next Phase Readiness

- `/agencies` and `/agencies/[id]` are fully functional: Super Admin can create an agency, add a user (one-time temp password), and toggle tenant grants optimistically
- Header nav lets Super Admin move between `/tenants` and `/agencies` freely
- Plan 09 (final verification/UAT) can now smoke-test the full agency-management flow end-to-end: create agency → add user → grant/revoke tenant → deactivate/reactivate

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: app/agencies/layout.tsx
- FOUND: app/agencies/page.tsx
- FOUND: app/agencies/[id]/page.tsx
- FOUND: components/agencies/create-agency-form.tsx
- FOUND: components/agencies/agencies-table.tsx
- FOUND: components/agencies/deactivate-agency-button.tsx
- FOUND: components/agencies/add-agency-user-modal.tsx
- FOUND: components/agencies/agency-tenant-grants.tsx
- FOUND: components/ui/checkbox.tsx
- FOUND: db7fa18 (Task 1 commit)
- FOUND: 58926f4 (Task 2 commit)
