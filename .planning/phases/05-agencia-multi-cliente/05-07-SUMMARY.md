---
phase: 05-agencia-multi-cliente
plan: 07
subsystem: frontend
tags: [nextjs, server-component, rls, agency, landing-page]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 02
    provides: "tenants_agency_select RLS policy — scopes this plan's Server Component tenants query to only the agency's granted, active tenants, with zero application-level filtering"
  - phase: 05-agencia-multi-cliente
    plan: 04
    provides: "proxy.ts redirects role === 'agency' to /agencia post-login — this plan builds the landing page that redirect target was pointing to (previously a 404)"
provides:
  - "app/agencia/page.tsx + app/agencia/layout.tsx — the /agencia route is now live, closing the 404 left by Plan 04's redirect"
  - "components/agencies/agency-clients-table.tsx — read-only tenant list, reusable by any future agency-facing screen needing the same presentational contract"
affects: [05-09-final-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agency-facing presentational components never link to Super-Admin-only routes (no /tenants/{slug}) — plain <span> instead of <Link> for the primary column, mirroring the D-01 boundary already established in sidebar-nav.tsx (Plan 04)"
    - "Agency-only Server Component layout guards standardize on getUser().app_metadata.role directly (not the manual decodeRole() JWT-decode helper app/tenants/layout.tsx still uses) — per 05-RESEARCH.md's correctness note, carried over from Plan 04's app/[tenant-slug]/layout.tsx guard rewrite"

key-files:
  created:
    - components/agencies/agency-clients-table.tsx
    - app/agencia/layout.tsx
    - app/agencia/page.tsx
  modified: []

key-decisions:
  - "app/agencia/page.tsx's loadGrantedTenants() query relies entirely on the tenants_agency_select RLS policy (Plan 02) to scope rows — no WHERE clause or agency_id filter written in application code, per RESEARCH.md's 'RLS does it for free' finding; verified no createServiceClient() import anywhere in the file"

requirements-completed: [AGENCY-03, AGENCY-04]

# Metrics
duration: ~10min
completed: 2026-07-10
---

# Phase 05 Plan 07: Agência Client-Selector Landing Page Summary

**Built `/agencia` — a plain, read-only tenant list + per-row "Entrar" action for agency users, closing the 404 left by Plan 04's post-login redirect. RLS (`tenants_agency_select`) is the sole scoping mechanism; the page adds no application-level filtering.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments

- Created `components/agencies/agency-clients-table.tsx` — adapted from `TenantsTable`: Nome cell is a plain `<span>` (no link to the Super-Admin-only `/tenants/{slug}` route), Slug column dropped entirely per UI-SPEC Screen 3's Nome/Status/Ações wireframe, empty state renders "Nenhum cliente vinculado à sua agência" / "Contate o Super Admin para solicitar acesso a um cliente."
- Created `app/agencia/layout.tsx` — minimal shell (logo + `LogoutButton` only, no "Tenants | Agências" nav), agency-only guard using `user.app_metadata.role` directly (not the manual `decodeRole()` helper `app/tenants/layout.tsx` uses), redirecting any non-`agency` role to `/`
- Created `app/agencia/page.tsx` — Server Component using the RLS-scoped `createClient()` (confirmed zero `createServiceClient` references), queries `tenants` ordered by name, renders `AgencyClientsTable` inside a `Suspense`/`Skeleton` loading boundary matching `app/tenants/page.tsx`'s pattern
- Verified: `npx tsc --noEmit` (only the 2 pre-existing, out-of-scope `vault-rpc.test.ts` errors remain), `npm run build` (Turbopack, clean — `/agencia` route appears in the route table as `ƒ /agencia`), full `npm test` (18 files, 143 passed / 1 skipped / 10 todo — no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AgencyClientsTable component (contract-first)** - `3e7ffaa` (feat)
2. **Task 2: Wire the /agencia route (layout + page)** - `d4dd603` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `components/agencies/agency-clients-table.tsx` - read-only tenant table for the agency landing page (no Super-Admin-only links, no Slug column)
- `app/agencia/layout.tsx` - minimal shell + agency-only role guard
- `app/agencia/page.tsx` - RLS-scoped Server Component rendering the granted tenant list

## Decisions Made

- `loadGrantedTenants()` in `app/agencia/page.tsx` performs an unfiltered `SELECT id, name, slug, active FROM tenants ORDER BY name` through the RLS-scoped client — the `tenants_agency_select` policy (Plan 02) is the only mechanism restricting rows to the agency's grants, deliberately avoiding any duplicate/driftable application-level filter, per the plan's threat model (T-05-11)

## Deviations from Plan

### Auto-fixed Issues

None required — the plan's provided code was executed verbatim for both tasks.

### Noted false positive in Task 1's automated verify command

- **Found during:** Task 1 verification
- **Issue:** The plan's automated verify command (`grep -c "/tenants/" ... | grep -q "^0$"`) is intended to confirm no Super-Admin-only `/tenants/{slug}` link exists, but the substring `/tenants/` also matches the legitimate import path `'@/components/tenants/tenant-status-badge'` (the exact reuse import specified in this same plan's `<interfaces>` block), producing a false-positive failure.
- **Resolution:** Manually confirmed the actual intent is satisfied — the file's only `Link` targets `/${tenant.slug}/dashboard`, there is no `<Link href="/tenants/...">` anywhere. No code change needed; this is a plan-authoring artifact in the verify script's grep pattern, not a defect in the component. Documented here rather than silently ignored per deviation-tracking discipline.
- **Files affected:** none (verification-only observation, no fix applied to source)

## Issues Encountered

- Same false-positive verify pattern as above; no other issues. `npx tsc --noEmit` shows only the 2 pre-existing, out-of-scope errors in `tests/integration/vault-rpc.test.ts` (lines 124, 135), already logged in `deferred-items.md` from Plan 05-01 — confirmed unrelated to this plan's files.

## User Setup Required

None — no external service configuration required. This plan only adds application routing/UI code; it depends on infrastructure already live from Plans 02 (RLS policy) and 04 (redirect wiring).

## Next Phase Readiness

- `/agencia` is now a live, working route: an agency user redirected here post-login (per Plan 04's `proxy.ts` branch) sees exactly their granted, active tenants via RLS, with a per-row "Entrar" action, and a correct empty state if they have zero grants
- No Super-Admin-only links present anywhere on the page (verified — no `/tenants/{slug}` `<Link>`)
- Ready for Plan 08 (leads scope enforcement) and Plan 09 (final verification/UAT checkpoint), which can now include a live smoke test of the full agency login → `/agencia` → `/{slug}/dashboard` flow

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: components/agencies/agency-clients-table.tsx
- FOUND: app/agencia/layout.tsx
- FOUND: app/agencia/page.tsx
- FOUND: .planning/phases/05-agencia-multi-cliente/05-07-SUMMARY.md
- FOUND: 3e7ffaa (Task 1 commit)
- FOUND: d4dd603 (Task 2 commit)
