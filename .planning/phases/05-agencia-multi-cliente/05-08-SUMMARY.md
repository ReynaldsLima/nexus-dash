---
phase: 05-agencia-multi-cliente
plan: 08
subsystem: api
tags: [security, bola, idor, leads, agency, rls]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    plan: 02
    provides: "agency_tenants table + RLS (agency_tenants_member_select policy) this plan's grant check queries"
provides:
  - "Server-derived tenant/agency scope verification on PATCH /api/leads/[id]/status — closes a pre-existing IDOR/BOLA gap (T-05-13)"
  - "'agency' role support for the Leads status write-back endpoint, gated by an agency_tenants grant lookup"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tenant/agency scope check runs BEFORE the service_role credential fetch, using the RLS-scoped `supabase` client for the agency_tenants grant lookup — same authorization-before-privileged-read shape as app/api/meta-ads/connect/route.ts, extended with a third branch for the 'agency' role"

key-files:
  created: []
  modified:
    - app/api/leads/[id]/status/route.ts
    - tests/unit/leads-status-route.test.ts

key-decisions:
  - "Followed the plan's exact code verbatim — no deviations. The agency_tenants query uses .select('tenant_id, tenants!inner(slug)').eq('agency_id', ...).eq('tenants.slug', ...) via the RLS-scoped client, not service_role, so RLS (agency_tenants_member_select from Plan 02) provides defense-in-depth under the explicit application-level filter"
  - "Renumbered all inline step comments (3→3, 4→4, new 5, old 5→6, old 6→7) to keep the file's step numbering sequential after inserting the new scope-check step"

requirements-completed: [AGENCY-05, AGENCY-08]

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 05 Plan 08: Leads Route Tenant/Agency Scope Enforcement Summary

**Closed a pre-existing IDOR/BOLA gap (OWASP API1:2023) in `PATCH /api/leads/[id]/status` by deriving tenant/agency scope server-side from `user.app_metadata` and an RLS-scoped `agency_tenants` grant lookup, instead of trusting the client-supplied `tenant` field — while also extending the route to support the new `agency` role.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-10T22:47:00Z
- **Completed:** 2026-07-10T22:59:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Widened the role gate in `app/api/leads/[id]/status/route.ts` to accept `'agency'` alongside `'super_admin'`/`'tenant_admin'`
- Inserted a new authorization step immediately after body parsing, before the `service_role` credential fetch:
  - `tenant_admin`: rejected with 403 unless `user.app_metadata.tenant_slug === tenantSlug` (closes the pre-existing cross-tenant IDOR — any `tenant_admin` could previously PATCH any tenant's lead status just by changing the body's `tenant` field)
  - `agency`: rejected with 403 (fail closed) if `app_metadata.agency_id` is missing; otherwise requires a matching row in `agency_tenants` (joined to `tenants` on slug) via the RLS-scoped `supabase` client
  - `super_admin`: unchanged, no additional check
- Renumbered the file's inline step comments so numbering stays sequential (1-7)
- Extended `tests/unit/leads-status-route.test.ts`'s `@/lib/supabase/server` mock with the `agency_tenants` chain (`.from().select().eq().eq().maybeSingle()`) and a configurable `user.app_metadata`
- Replaced all 5 `it.todo()` placeholders under the AGENCY-08 describe block with real, passing assertions
- Verified zero regressions across the full test suite, `tsc --noEmit`, and `npm run build`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add server-derived tenant/agency scope verification to the Leads status route** - `386ab71` (fix)
2. **Task 2: Fill the AGENCY-08 test cases in leads-status-route.test.ts** - `5398577` (test)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `app/api/leads/[id]/status/route.ts` - added tenant/agency scope check (step 5), widened role gate to include `agency`, renumbered steps 3-7
- `tests/unit/leads-status-route.test.ts` - mock extended with `agency_tenants` chain + configurable `app_metadata`; 5 real tests replace `it.todo()` placeholders

## Decisions Made

- Executed the plan's provided code verbatim for both tasks — no adaptation needed, the exact pattern from `app/api/meta-ads/connect/route.ts` (server-derived scope, checked before the privileged `service_role` fetch) applied cleanly to the slug-based Leads route
- Confirmed via grep that the `agency_tenants` query sits outside the `const service = createServiceClient()` block, using the RLS-scoped `supabase` client — satisfies the plan's defense-in-depth requirement (RLS from Plan 02's `agency_tenants_member_select` policy backs up the explicit `.eq('agency_id', ...)` filter)

## Verification Results

- `npx vitest run tests/unit/leads-status-route.test.ts` — 15/15 passing (10 pre-existing + 5 new; plan's frontmatter estimated "9 pre-existing" but the file actually had 10 tests in the original `describe` block — no discrepancy in coverage, just a documentation undercount in the plan)
- `npm test` (full suite) — 18 files, 148 passed / 1 skipped / 5 todo (unrelated pre-existing todos in other files), zero failures
- `npx tsc --noEmit` — only the 2 pre-existing, unrelated errors in `tests/integration/vault-rpc.test.ts` (already logged in `deferred-items.md` from Plan 05-01/02) — no new errors
- `npm run build` — compiles cleanly, `/api/leads/[id]/status` listed as a dynamic route, no new warnings

## Deviations from Plan

None — plan executed exactly as written. The only note is a minor documentation discrepancy in the plan's own frontmatter (it described "9 pre-existing" tests where the file actually had 10), which does not affect coverage or correctness — all pre-existing tests were preserved unmodified and all pass.

## Issues Encountered

None.

## Next Phase Readiness

- The Leads status route now closes the last of this phase's "who can reach which tenant's data" gaps — `tenant_admin` and `agency` roles are both scoped server-side, `super_admin` unchanged
- This was the final plan in Wave 3; remaining Phase 05 work is Plan 06 (agency management UI, no dependency on this plan) and Plan 09 (final verification/UAT)
- No new blockers introduced

---
*Phase: 05-agencia-multi-cliente*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: app/api/leads/[id]/status/route.ts
- FOUND: tests/unit/leads-status-route.test.ts
- FOUND: .planning/phases/05-agencia-multi-cliente/05-08-SUMMARY.md
- FOUND: 386ab71 (Task 1 commit)
- FOUND: 5398577 (Task 2 commit)
