---
phase: 01-foundation
plan: "05"
subsystem: auth-ui
tags: [tenants, super-admin, tenant-switcher, rbac, server-actions, shadcn]

requires:
  - phase: 01-04
    provides: login-page, tenant-routes, tenant-actions, authenticated layout
  - phase: 01-03
    provides: supabase clients, middleware, auth actions
  - phase: 01-02
    provides: tenants schema, RLS policies, custom access token hook

provides:
  - /tenants overview page with table + create-tenant dialog
  - /tenants/[slug] detail page with user provisioning modal
  - Tenant switcher dropdown (super_admin only) in authenticated header
  - AlertDialog-based soft delete for tenants (D-08)
  - One-time temp password reveal after user creation (D-10)

affects: [02-data-pipeline, 03-dashboard-ui]

tech-stack:
  added: []
  patterns:
    - "shadcn AlertDialog for destructive confirmation flows"
    - "shadcn DropdownMenu for tenant switcher (super_admin-only via null return)"
    - "One-time password reveal via useState — never persisted, cleared on modal close"
    - "Server Component + createClient for tenants fetch; service_role only in Server Actions"
    - "Base UI render prop pattern for Button-as-Link (not asChild)"

key-files:
  created:
    - app/tenants/layout.tsx
    - app/tenants/page.tsx
    - app/tenants/[slug]/page.tsx
    - components/tenants/tenants-table.tsx
    - components/tenants/tenant-status-badge.tsx
    - components/tenants/create-tenant-form.tsx
    - components/tenants/add-user-modal.tsx
    - components/tenants/deactivate-tenant-button.tsx
    - components/tenants/tenant-switcher.tsx
  modified:
    - app/[tenant-slug]/layout.tsx

key-decisions:
  - "D-01: TenantSwitcher renders null for non-super_admin — role check in component, not CSS visibility"
  - "D-08: Soft delete via AlertDialog — deactivateTenant sets active=false, reactivateTenant reverses"
  - "D-10: Temp password stored in useState only — displayed once in <code> block, cleared on modal close"
  - "D-11: No user listing in v1 — Supabase Dashboard used instead"
  - "Base UI render prop (render={<Link />}) used instead of asChild — required by shadcn v3+ with Base UI primitives"

patterns-established:
  - "Tenant detail pages: Server Component + notFound() for unknown slug"
  - "Role guard in layout via JWT decode (Buffer.from base64) — no extra DB round-trip"
  - "Tenant switcher: super_admin-only, passed tenants list from Server Component as prop"

requirements-completed: [AUTH-03, AUTH-04, AUTH-05]

duration: ~10min (Tasks 1+2 automated; Task 3 pending manual UAT)
completed: "2026-05-16"
---

# Phase 01 Plan 05: Super Admin Tenant Management UI Summary

**Super Admin tenant management UI: /tenants overview, /tenants/[slug] detail, add-user modal with one-time password reveal, AlertDialog soft-delete, and TenantSwitcher dropdown in authenticated header.**

## Performance

- **Duration:** ~10 min (automated tasks)
- **Started:** 2026-05-11
- **Completed:** 2026-05-16 (Tasks 1+2 complete; Task 3 is manual UAT checkpoint)
- **Tasks:** 2/3 automated tasks complete (Task 3 = manual UAT checkpoint)
- **Files modified:** 10

## Accomplishments

- `/tenants` overview page with shadcn Table (Nome, Slug, Status, Ações columns), empty state, `+ Novo tenant` dialog
- `/tenants/[slug]` detail page with tenant info, `DeactivateTenantButton` (AlertDialog confirm), and `AddUserModal` (temp password shown once, clipboard copy button)
- `TenantSwitcher` dropdown embedded in `/[tenant-slug]/layout.tsx` — visible only for `super_admin`, navigates between tenants without logout (AUTH-04)
- All UI copywriting matches UI-SPEC exactly (pt-BR, status badges Ativo/Inativo, modal titles, error messages)
- Build: `npm run build` exits 0, all 8 routes compile successfully

## Task Commits

1. **Task 1: /tenants overview — layout, table, status badge, create-tenant form** — included in `8080223` (feat(01-05))
2. **Task 2: /tenants/[slug] detail + add-user modal + deactivate AlertDialog + tenant switcher** — included in `8080223` (feat(01-05))
3. **Task 3: Manual UAT checkpoint** — PENDING (human verification required)

**Note:** Tasks 1 and 2 were committed together in a single commit `8080223` from a prior session execution.

## Files Created/Modified

- `app/tenants/layout.tsx` — Super Admin only layout: JWT decode role guard + redirect to `/` for non-super_admin
- `app/tenants/page.tsx` — Tenants overview: fetches all tenants via `createClient()`, renders table + create dialog
- `app/tenants/[slug]/page.tsx` — Tenant detail: fetches by slug, `notFound()` on missing, info card + deactivate + add-user
- `components/tenants/tenants-table.tsx` — Server Component table with Nome/Slug/Status/Ações columns + empty state
- `components/tenants/tenant-status-badge.tsx` — Ativo (emerald) / Inativo (zinc) badge per UI-SPEC colors
- `components/tenants/create-tenant-form.tsx` — Client Component: Dialog + RHF-style form → `createTenant` Server Action
- `components/tenants/add-user-modal.tsx` — Client Component: Dialog, E-mail + Role Select, `createTenantUser` action, temp password reveal + clipboard copy (D-10)
- `components/tenants/deactivate-tenant-button.tsx` — Client Component: AlertDialog confirm before `deactivateTenant` / `reactivateTenant` (D-08)
- `components/tenants/tenant-switcher.tsx` — Client Component: DropdownMenu, `super_admin` only via null return (D-01), navigates to `/${slug}/dashboard`
- `app/[tenant-slug]/layout.tsx` — Modified: embeds `<TenantSwitcher>` next to `LogoutButton`; loads tenants list only for `super_admin`

## Decisions Made

- Base UI render prop pattern (`render={<Link />}`) used for Button-as-Link — required by this project's shadcn version which uses Base UI primitives (not Radix). The plan's `asChild` pattern was adapted accordingly.
- `TenantSwitcher` returns `null` (not hidden via CSS) for non-super_admin — cleaner than visibility toggle
- Tenants list for switcher loaded server-side in layout and passed as props — avoids client-side fetch on every navigation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shadcn Button render prop instead of asChild**
- **Found during:** Task 1/2 (pre-existing pattern from Plan 04)
- **Issue:** Plan's code samples used `<Button asChild>` / `<DialogTrigger asChild>` but the installed shadcn version uses Base UI primitives requiring `render={<Component />}` prop pattern. Using `asChild` would cause a TypeScript error.
- **Fix:** All Button-as-Link and trigger components use `render={<Link />}` or `render={<Button />}` prop pattern — consistent with existing codebase patterns established in Plan 04.
- **Files modified:** `components/tenants/tenants-table.tsx`, `components/tenants/create-tenant-form.tsx`, `components/tenants/add-user-modal.tsx`, `components/tenants/deactivate-tenant-button.tsx`, `components/tenants/tenant-switcher.tsx`
- **Commit:** 8080223

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, consistent with prior plan pattern)
**Impact on plan:** Necessary adaptation to installed library version. No functional scope change.

## Manual UAT — PENDING

Task 3 is a `checkpoint:human-verify` requiring manual verification of 6 UAT scripts:

| Script | Requirement | Status |
|--------|-------------|--------|
| Script 1 | AUTH-01: Session persistence across browser sessions | PENDING |
| Script 2 | AUTH-02: Logout invalidates session immediately | PENDING |
| Script 3 | AUTH-04: Tenant switcher navigates without logout | PENDING |
| Script 4 | AUTH-05: tenant_admin blocked from /tenants | PENDING |
| Script 5 | AUTH-06: Cross-tenant RLS curl test returns [] | PENDING |
| Script 6 | D-08: Soft delete blocks tenant access, reactivation restores | PENDING |

**To complete:** Run the 6 scripts in the plan's Task 3 against the deployed app and respond with `uat-ok` or `fail: [numbers]`.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `app/[tenant-slug]/dashboard/page.tsx` | "Dashboard em construção" placeholder | Campaign metrics not available until Phase 2 |
| `app/[tenant-slug]/campanhas/page.tsx` | "Campanhas em construção" placeholder | Campaign listing not available until Phase 3 |
| `app/[tenant-slug]/insights/page.tsx` | "Insights em construção" placeholder | AI insights not available until Phase 4 |

These stubs are intentional scaffolding from Plan 04 — each will be wired in the referenced future plan. They do not block this plan's goal (Super Admin tenant management UI).

## Threat Flags

No new threat surface beyond what was planned in the threat model. All T-01-U* mitigations implemented:
- T-01-U3: `/tenants/layout.tsx` role check implemented (super_admin guard)
- T-01-U5: Temp password in `useState` only — not logged, cleared on modal close
- T-01-U6: Role validation in `createTenantUser` Server Action (tenant_admin/viewer only — from Plan 04)
- T-01-U9: `notFound()` on unknown slug in tenant detail page; JWT slug check in `[tenant-slug]/layout.tsx`

## Self-Check: PASSED

Files exist:
- FOUND: app/tenants/layout.tsx
- FOUND: app/tenants/page.tsx
- FOUND: app/tenants/[slug]/page.tsx
- FOUND: components/tenants/tenants-table.tsx
- FOUND: components/tenants/tenant-status-badge.tsx
- FOUND: components/tenants/create-tenant-form.tsx
- FOUND: components/tenants/add-user-modal.tsx
- FOUND: components/tenants/deactivate-tenant-button.tsx
- FOUND: components/tenants/tenant-switcher.tsx
- FOUND: app/[tenant-slug]/layout.tsx (modified)

Commits exist:
- FOUND: 8080223 (feat(01-05): tenant management UI)

Build: npm run build exits 0 — all 8 routes compile, TypeScript passes.

---
*Phase: 01-foundation*
*Completed: 2026-05-16*
