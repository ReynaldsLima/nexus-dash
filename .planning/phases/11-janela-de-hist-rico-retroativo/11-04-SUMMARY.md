---
phase: 11-janela-de-hist-rico-retroativo
plan: 04
subsystem: settings
tags: [server-actions, zod, supabase-rls, tanstack-query, optimistic-ui, ad-accounts]

# Dependency graph
requires:
  - phase: 11-janela-de-hist-rico-retroativo
    provides: "ad_accounts.backfill_days column (migration 0024) and the connect-time backfillDays field from Plans 02/03"
provides:
  - "updateBackfillWindow Server Action (lib/actions/ad-accounts.ts) — super_admin OR own-tenant tenant_admin scoped write to ad_accounts.backfill_days"
  - "BackfillWindowControl — reusable always-editable inline number control with optimistic save + revert-on-failure"
  - "Settings page renders BackfillWindowControl next to each connected channel's ChannelStatusBadge"
affects: [12-redesign-visual]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-layer authorization gate inline in a Server Action (not the shared requireSuperAdmin() helper) when a tenant_admin also needs scoped access — verified via getClaims(), never getUser().app_metadata"
    - "Service-role write bypassing an RLS policy that blocks a role's UPDATE, gated by an explicit in-action authorization check before the write"

key-files:
  created:
    - lib/actions/ad-accounts.ts
    - tests/unit/ad-accounts-actions.test.ts
    - components/settings/backfill-window-control.tsx
  modified:
    - "app/[tenant-slug]/settings/page.tsx"

key-decisions:
  - "requireSuperAdmin() from lib/actions/auth-guard.ts is intentionally NOT reused — SET-05 requires tenant_admin access too, so the authorization gate is written inline in updateBackfillWindow"
  - "BackfillWindowControl renders only when an ad_accounts row exists for the channel (status connected or invalid) — guarded by `!== 'not_configured'`, matching the CONTEXT.md guard guidance"

patterns-established:
  - "Optimistic Server Action call with revert-on-failure for a single scalar field, following the lib/leads.ts / agency-tenant-grants.tsx precedent (D-03)"

requirements-completed: [SET-05]

# Metrics
duration: 6min
completed: 2026-07-17
---

# Phase 11 Plan 04: Post-Connection Backfill Window Edit Summary

**Scoped `updateBackfillWindow` Server Action plus an always-editable optimistic inline control, letting a Tenant Admin change an already-connected account's backfill window without reconnecting**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-17T23:11:26Z
- **Completed:** 2026-07-17T23:16:50Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- `updateBackfillWindow` Server Action enforces super_admin-or-own-tenant-tenant_admin scope (cross-tenant tenant_admin calls rejected via `getClaims()`, never `getUser().app_metadata`) and writes `ad_accounts.backfill_days` via the service-role client, since RLS blocks tenant_admin UPDATE on that table
- `BackfillWindowControl` — an always-visible number input with a "Salvar" button that appears only on change, optimistic save with revert-on-failure and an inline `role="alert"` error block (no toast/Sonner)
- Settings page extended (`AdAccountStatus`/`TenantSettingsData`, widened `ad_accounts` select) to load `backfill_days` and render the control below each connected/invalid channel's form

## Task Commits

Each task was committed atomically (TDD RED→GREEN for Task 1):

1. **Task 1: updateBackfillWindow Server Action + spec** - `9f1c74e` (test, RED) + `620d059` (feat, GREEN)
2. **Task 2: BackfillWindowControl inline component** - `90729b4` (feat)
3. **Task 3: Wire BackfillWindowControl into the Settings page** - `31331db` (feat)

## Files Created/Modified
- `lib/actions/ad-accounts.ts` - `updateBackfillWindow` Server Action: Zod validation, super_admin/tenant_admin gate, service-role UPDATE, `revalidatePath`
- `tests/unit/ad-accounts-actions.test.ts` - 6 tests covering super_admin ok, own-tenant tenant_admin ok, cross-tenant tenant_admin rejected, unauthenticated rejected, and both out-of-range (5/400) rejections
- `components/settings/backfill-window-control.tsx` - Reusable `'use client'` control: value/persisted/error/saving state, conditional "Salvar" button, D-05 help text, D-06 inline error block
- `app/[tenant-slug]/settings/page.tsx` - Extended select/interface/data-fetching with `backfill_days`, imports and renders `BackfillWindowControl` for both Meta and Google cards guarded on `!== 'not_configured'`

## Decisions Made
- Wrote the authorization gate inline in `updateBackfillWindow` rather than extending/reusing `requireSuperAdmin()`, since that helper is intentionally super_admin-only and SET-05 requires tenant_admin access scoped to their own tenant
- Followed the plan's literal code for all three tasks with no structural deviation

## Deviations from Plan

None - plan executed exactly as written, with one minor doc-comment wording tweak in `lib/actions/ad-accounts.ts` (avoiding the literal string `requireSuperAdmin` in a comment so the acceptance-criteria grep for its absence is unambiguous — no code behavior change).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SET-05 fully satisfied; Phase 11's SET-03/04/05 requirement set for backfill window (connect-time + post-connect edit) is now code-complete
- Settings page is intentionally left functional-only (no visual polish) per CONTEXT.md — Phase 12 (Redesign Visual) will restyle this page, including the new `BackfillWindowControl`
- No blockers for Phase 12

---
*Phase: 11-janela-de-hist-rico-retroativo*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 4 created/modified files confirmed present on disk; all 4 task commit hashes (9f1c74e, 620d059, 90729b4, 31331db) confirmed in git history.
