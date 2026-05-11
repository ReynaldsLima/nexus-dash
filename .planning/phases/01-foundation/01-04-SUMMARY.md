---
phase: "01"
plan: "04"
subsystem: "auth-ui"
tags: [auth, ui, server-actions, tenants, routing]
dependency_graph:
  requires: ["01-03"]
  provides: ["login-page", "tenant-routes", "tenant-actions"]
  affects: ["app/layout.tsx", "middleware.ts"]
tech_stack:
  added: []
  patterns:
    - "useActionState for progressive-enhancement forms (React 19)"
    - "JWT decode in RSC for role/slug guard without extra DB query"
    - "Server Action with Zod v4 validation + service_role client"
key_files:
  created:
    - lib/actions/tenants.ts
    - app/login/page.tsx
    - components/auth/login-form.tsx
    - components/auth/logout-button.tsx
    - app/[tenant-slug]/layout.tsx
    - app/[tenant-slug]/dashboard/page.tsx
    - app/[tenant-slug]/campanhas/page.tsx
    - app/[tenant-slug]/insights/page.tsx
  modified:
    - app/layout.tsx
    - tests/tenants.test.ts
decisions:
  - "Replaced test fixture UUIDs (00000000-...-000001) with valid RFC 4122 v4 UUIDs — Zod v4 enforces strict UUID format"
  - "JWT decode in TenantLayout uses Buffer.from(payload, 'base64') — avoids extra Supabase DB round-trip for role check"
metrics:
  duration_minutes: 9
  completed_date: "2026-05-11"
  tasks_completed: 3
  files_created: 8
  files_modified: 2
---

# Phase 01 Plan 04: Auth UI + Tenant Routes + Tenant Actions Summary

**One-liner:** Login form with useActionState, tenant server actions (CRUD + user provisioning), and authenticated [tenant-slug] layout with JWT role guard.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Tenant server actions + test suite | d3acdb3 |
| 2 | Login page, auth components, root layout | 5fd2a94 |
| 3 | Authenticated tenant layout + scaffolded routes | ebca6e3 |

## What Was Built

### Task 1 — Tenant Server Actions (`lib/actions/tenants.ts`)

Exports `createTenant`, `deactivateTenant`, `reactivateTenant`, `createTenantUser` — all validated with Zod v4, using `createServiceClient()` (service_role key). User creation via `supabase.auth.admin.createUser` with `email_confirm: true` and auto-generated 16+ char temp password. Rollback: if `tenant_users` insert fails, the auth user is deleted.

`tests/tenants.test.ts` now has zero `it.todo()` calls — all 11 tests pass including:
- createTenant: success, duplicate slug (23505), invalid slug regex
- deactivateTenant: sets active=false, DB error propagation
- createTenantUser: email_confirm, viewer/tenant_admin roles, super_admin rejection, temp password length

### Task 2 — Auth UI

- `app/login/page.tsx` — Card-wrapped login page with metadata
- `components/auth/login-form.tsx` — `useActionState` bound to `signIn`, shows `no_membership` error from searchParams, inline error display with `role="alert"`
- `components/auth/logout-button.tsx` — form action bound to `signOut`, accessible `aria-label`
- `app/layout.tsx` — Updated: `lang="pt-BR"`, NEXUS-DASH metadata, `TenantStoreProvider` wraps children

### Task 3 — Authenticated Tenant Layout + Routes

- `app/[tenant-slug]/layout.tsx` — Guards: `getUser()` redirects to `/login` if unauthenticated; decodes JWT `app_metadata` to extract `role` and `tenant_slug`; non-super_admin users whose `tenant_slug` doesn't match `urlSlug` are redirected to `/`; renders header with NEXUS-DASH link + LogoutButton + tenant-controls slot for Plan 05
- Scaffolded routes (placeholder Cards):
  - `/[tenant-slug]/dashboard` — "Dashboard em construção" (Phase 2)
  - `/[tenant-slug]/campanhas` — "Campanhas em construção" (Phase 3)
  - `/[tenant-slug]/insights` — "Insights em construção" (Phase 4)

## Test Results

```
Tests: 19 passed | 5 skipped (RLS integration — needs live Supabase creds)
Test Files: 3 passed
Build: exit 0
Routes: /, /login, /[tenant-slug]/campanhas, /[tenant-slug]/dashboard, /[tenant-slug]/insights
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture UUIDs invalid for Zod v4**
- **Found during:** Task 1 — first test run
- **Issue:** Plan-provided test UUIDs (`00000000-0000-0000-0000-000000000001`) fail Zod v4's strict RFC 4122 validation which requires version digit `[1-8]` and variant bits `[89abAB]`. The `tenantIdSchema` (`z.string().uuid()`) and `createUserSchema` rejected them, returning `{ error: 'tenantId inválido' }` / `{ error: 'Invalid UUID' }` before reaching the mock.
- **Fix:** Replaced all test fixture UUIDs with valid RFC 4122 v4 UUID `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (defined as `TEST_TENANT_ID` constant). Server action validation logic unchanged — it is correct.
- **Files modified:** `tests/tenants.test.ts`
- **Commit:** d3acdb3

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `app/[tenant-slug]/dashboard/page.tsx` | "Dashboard em construção" placeholder | Campaign metrics not available until Phase 2 |
| `app/[tenant-slug]/campanhas/page.tsx` | "Campanhas em construção" placeholder | Campaign listing not available until Phase 3 |
| `app/[tenant-slug]/insights/page.tsx` | "Insights em construção" placeholder | AI insights not available until Phase 4 |
| `app/[tenant-slug]/layout.tsx` | `data-slot="tenant-controls"` empty (no switcher) | Tenant switcher populated in Plan 05 for super_admin |

These stubs are intentional scaffolding — each will be wired in the referenced future plan. The plan's goal (auth-protected routing with correct role guards) is fully achieved.

## Threat Flags

None — no new network endpoints, auth paths beyond the planned login route, or schema changes introduced.

## Self-Check: PASSED

Files exist:
- FOUND: lib/actions/tenants.ts
- FOUND: app/login/page.tsx
- FOUND: components/auth/login-form.tsx
- FOUND: components/auth/logout-button.tsx
- FOUND: app/[tenant-slug]/layout.tsx
- FOUND: app/[tenant-slug]/dashboard/page.tsx
- FOUND: app/[tenant-slug]/campanhas/page.tsx
- FOUND: app/[tenant-slug]/insights/page.tsx

Commits exist:
- FOUND: d3acdb3 (tenant server actions + tests)
- FOUND: 5fd2a94 (login UI + layout)
- FOUND: ebca6e3 (tenant layout + routes)
