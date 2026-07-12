---
phase: 05-agencia-multi-cliente
plan: 04
subsystem: frontend
tags: [nextjs, middleware, rls, routing, agency, sidebar, switcher]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 02
    provides: "tenants_agency_select RLS policy — required for the new layout guard query and loadTenantsForSwitcher() to return correctly-scoped rows for an agency JWT"
  - phase: 05-agencia-multi-cliente
    plan: 03
    provides: "tenant_users.role collapsed to single tenant_admin value — routing logic in this plan keeps the 'viewer' branch only for rollout safety, not because it is reachable post-migration"
provides:
  - "proxy.ts redirects role === 'agency' to /agencia post-login and blocks non-super_admin from /agencies"
  - "app/[tenant-slug]/layout.tsx guard is a live RLS-scoped tenants existence query (no JWT string equality) — works identically for Cliente/Agencia/Super Admin, and now re-verifies tenant active status on every request"
  - "TenantSwitcher/HeaderActions/SidebarNav/tenant-store Role type all recognize role === 'agency' with correct scoping and copy (manageHref/manageLabel, insights hidden, Conta section hidden)"
affects: [05-05-agency-actions, 05-06-agency-tenant-management-ui, 05-07-agency-landing-page, 05-08-leads-scope-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "proxy.ts role branches are UX-only redirect hints, never authorization — the actual data boundary is RLS + a live re-query in the Server Component layout guard (T-05-07/T-05-08 threat register)"
    - "Switcher/sidebar components accept role as a plain string (not the narrower union) so they degrade safely for any unrecognized/future role value — only role === 'agency' triggers special-casing, everything else renders today's unfiltered behavior"

key-files:
  created: []
  modified:
    - proxy.ts
    - tests/middleware.test.ts
    - app/[tenant-slug]/layout.tsx
    - components/tenants/tenant-switcher.tsx
    - components/layout/header-actions.tsx
    - components/layout/sidebar-nav.tsx
    - lib/stores/tenant-store.tsx

key-decisions:
  - "Kept 'viewer' in both proxy.ts's AppMetadata.role union and lib/stores/tenant-store.tsx's Role type even though Plan 03 collapsed tenant_users.role to a single tenant_admin value live — deliberate rollout-safety choice per this plan's own task instructions, not an oversight, in case an unmigrated cached/stale JWT with role='viewer' is still in circulation at deploy time"
  - "The Conta/Configuracoes sidebar section is hidden via a full conditional block (role !== 'agency' && <div>...</div>), not CSS visibility — avoids a dangling border-t divider with nothing above it, per 05-UI-SPEC.md"

requirements-completed: [AGENCY-03, AGENCY-04]

# Metrics
duration: ~10min
completed: 2026-07-09
---

# Phase 05 Plan 04: Agency Routing & Navigation Summary

**Wired the Agencia role through proxy.ts (post-login redirect + /agencies guard), replaced app/[tenant-slug]/layout.tsx's JWT-string-equality tenant guard with a live RLS-scoped existence query, and extended the tenant switcher/sidebar/header/store to recognize and correctly scope the agency role.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-09
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `proxy.ts`: widened `AppMetadata.role` union to include `'agency'`; added a `role === 'agency'` redirect branch to `/agencia` on post-login (before the `no_membership` fallback); added a new `/agencies` guard block (parallel to the existing `/tenants` guard) that redirects any non-`super_admin` to `/`
- `tests/middleware.test.ts`: appended a new `describe('agency role claims (AGENCY-03)')` block asserting the agency claim shape decodes correctly, without touching any pre-existing test
- `app/[tenant-slug]/layout.tsx`: replaced the old `tokenSlug !== urlSlug` JWT-string-equality guard with a live, RLS-scoped `tenants` existence query (`.eq('slug', urlSlug).eq('active', true).maybeSingle()`) that works identically for Cliente, Agencia, and Super Admin — this also closes a latent bug where a Cliente's tenant being deactivated between login and page load was never re-checked; widened the switcher-data gate to `role === 'super_admin' || role === 'agency'`; computed `manageHref`/`manageLabel` based on role and threaded them to `HeaderActions`, and threaded `role` to `SidebarNav`
- `components/tenants/tenant-switcher.tsx`: widened the role guard to `role !== 'super_admin' && role !== 'agency'`, added optional `manageHref`/`manageLabel` props (defaulting to the pre-existing tenant-management copy/route) used in the `onChange` handler and trailing option
- `components/layout/header-actions.tsx`: added optional `manageHref`/`manageLabel` props, passed through to `TenantSwitcher`
- `components/layout/sidebar-nav.tsx`: added an optional `role` param; filters `AI Insights` out of `MARKETING_ITEMS` and hides the entire `Conta` (Configuracoes) block for `role === 'agency'`; any other role value (including `null`/`undefined`) renders identically to today's unfiltered output
- `lib/stores/tenant-store.tsx`: widened `Role` type to include `'agency'` (kept `'viewer'` for rollout safety, per plan instruction)
- Verified: `npx vitest run tests/middleware.test.ts` (8/8 passed), full `npm test` (18 test files, 132 passed / 1 skipped / 21 todo — no regressions), `npx tsc --noEmit` (only the 2 pre-existing, out-of-scope `vault-rpc.test.ts` errors remain, no new errors), `npm run build` (Turbopack, clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: proxy.ts agency post-login redirect + /agencies guard** - `71b7b4d` (feat)
2. **Task 2: app/[tenant-slug]/layout.tsx live RLS-scoped guard + role/manageHref wiring** - `d8b59ee` (feat)
3. **Task 3: Extend tenant-switcher, sidebar-nav, header-actions, tenant-store for the agency role** - `7e21dc9` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `proxy.ts` - agency redirect branch to `/agencia`, `/agencies` guard, `AppMetadata.role` union widened
- `tests/middleware.test.ts` - new `describe('agency role claims (AGENCY-03)')` block appended
- `app/[tenant-slug]/layout.tsx` - live RLS-scoped guard (`.eq('active', true).maybeSingle()`), `manageHref`/`manageLabel` computed and threaded, `role` threaded to `SidebarNav`
- `components/tenants/tenant-switcher.tsx` - `manageHref`/`manageLabel` props, widened role guard
- `components/layout/header-actions.tsx` - `manageHref`/`manageLabel` props threaded through
- `components/layout/sidebar-nav.tsx` - `role` param, filters `insights` and hides `Conta` section for agency
- `lib/stores/tenant-store.tsx` - `Role` type widened to include `'agency'`

## Decisions Made

- Retained `'viewer'` in both `proxy.ts`'s `AppMetadata.role` union and `lib/stores/tenant-store.tsx`'s `Role` type even though Plan 03's migration collapsed `tenant_users.role` to a single live value (`tenant_admin`) — deliberate rollout-safety choice specified by this plan's own task instructions (a stale/cached JWT with `role: 'viewer'` must still route correctly during rollout), not a missed cleanup opportunity
- Hid the Conta/Configuracoes sidebar section via a full conditional block rather than CSS `hidden`/`display:none`, to avoid a dangling `border-t` divider with no content above it (per 05-UI-SPEC.md)

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria (grep assertions, `npx tsc --noEmit`, `npm run build`, `npm test`) passed without requiring any Rule 1-4 deviation.

## Issues Encountered

- `npx tsc --noEmit` shows the same 2 pre-existing, out-of-scope errors in `tests/integration/vault-rpc.test.ts` (lines 124, 135) already logged in `deferred-items.md` from Plan 05-01 — confirmed unrelated to this plan's files, left untouched per the scope boundary.
- Task 2's mid-flight IDE diagnostics correctly flagged `manageHref`/`manageLabel`/`role` as unused/type-mismatched props on `HeaderActions`/`SidebarNav` — this was expected and explicitly called out in the plan's own acceptance criteria ("will only fully pass once Task 3 updates the two child components' prop types in this same plan"); resolved once Task 3 completed.

## User Setup Required

None - no external service configuration required. This plan only touches application routing/navigation code; it depends on infrastructure already live from Plans 02/03 (agency RLS policies, Auth Hook fix, tenant role collapse).

## Next Phase Readiness

- An agency user landing on `/` or `/login` post-auth is now redirected to `/agencia`, not `/login?error=no_membership`
- A Super Admin visiting `/agencies` is allowed through; any other role is redirected to `/`
- `[tenant-slug]/layout.tsx`'s guard is a live RLS-scoped query — an agency user visiting a `/{granted-tenant-slug}/...` route is correctly allowed through via `tenants_agency_select` (Plan 02), not blocked by a stale JWT string check
- Switcher/sidebar/header/store all correctly branch on `role === 'agency'` with the copy and scoping specified in 05-UI-SPEC.md
- Ready for Plan 05 (agency Server Actions) and Plan 07 (agency landing page `/agencia`, which this plan's redirects now target but which does not yet exist as a route — expected, since that page is a later plan's deliverable)

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: proxy.ts
- FOUND: tests/middleware.test.ts
- FOUND: app/[tenant-slug]/layout.tsx
- FOUND: components/tenants/tenant-switcher.tsx
- FOUND: components/layout/header-actions.tsx
- FOUND: components/layout/sidebar-nav.tsx
- FOUND: lib/stores/tenant-store.tsx
- FOUND: .planning/phases/05-agencia-multi-cliente/05-04-SUMMARY.md
- FOUND: 71b7b4d (Task 1 commit)
- FOUND: d8b59ee (Task 2 commit)
- FOUND: 7e21dc9 (Task 3 commit)
