---
phase: 12-redesign-visual
plan: 02
subsystem: ui
tags: [tailwind, css, next.js, layout, sidebar, chrome]

# Dependency graph
requires:
  - phase: 12-redesign-visual (Plan 01)
    provides: ".t-label utility class, --viz-* tokens, Card primitive fix — consumed verbatim here"
provides:
  - Sidebar nav with prototype's translucent lime-wash active state (bg-primary/10 text-primary font-medium)
  - Header chrome (blurred translucent bg, Syne 800 17px logo) matching prototype's .header/.logo
  - Tenant switcher and date-range trigger restyled as rounded-full pills on the card surface
affects: [12-03, 12-04, 12-05, 12-06, 12-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 locked weight enforcement: Bricolage Grotesque nav/badge elements use font-medium (500) never font-semibold (600); Syne logo/switcher-label elements use font-extrabold/font-bold (800/700) never font-semibold (600)"

key-files:
  created: []
  modified:
    - components/layout/sidebar-nav.tsx
    - app/[tenant-slug]/layout.tsx
    - components/layout/header-actions.tsx
    - components/tenants/tenant-switcher.tsx
    - components/dashboard/date-range-picker.tsx

key-decisions:
  - "None - plan executed exactly as written, all class-string edits applied verbatim per the plan's literal action text"

patterns-established:
  - "Chrome restyle pattern: only Tailwind class-string edits + one style={{fontFamily}} literal — zero prop signature, routing, store-binding, or auth-guard changes, verified by grep-based acceptance criteria on unchanged call sites"

requirements-completed: [DESIGN-05]

# Metrics
duration: 12min
completed: 2026-08-01
---

# Phase 12 Plan 02: Shared Chrome Restyle Summary

**Sidebar nav, header bar/logo, tenant switcher, and date-range trigger restyled to match `prototipos/nexus-dash.html`'s lime-wash/pill/blur treatment, with zero changes to `HeaderActions`/`SidebarNav` prop contracts or the layout's auth/RLS guard.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-01T22:34:00Z
- **Completed:** 2026-08-01T22:46:00Z
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- `components/layout/sidebar-nav.tsx`: active nav item is now a translucent `bg-primary/10 text-primary font-medium` wash (was a solid `bg-sidebar-primary` block with `shadow-sm`); all three section labels (`Marketing`/`Leads`/`Conta`) use the `.t-label` utility from Plan 01; icons dim to 60% opacity when inactive; the anomaly badge weight normalized to `font-medium` — file now contains zero `font-semibold`
- `app/[tenant-slug]/layout.tsx`: header is `bg-background/95 backdrop-blur-md` (translucent app-background + blur, replacing the flat `bg-card` bar); logo is Syne `font-extrabold` (800) at `text-[17px]` (was `font-semibold`/600 at 14px) — `.logo-dot`, sidebar width, main padding, and the `getClaims()` auth/RLS guard above line 73 are byte-identical to before
- `components/layout/header-actions.tsx`: gap tightened from `gap-2` to `gap-2.5` (10px), matching the prototype's `.hr` — `HeaderActionsProps` type unchanged
- `components/tenants/tenant-switcher.tsx`: switcher is now a `rounded-full bg-card` pill with Syne `font-bold` (700) `text-xs` label and an accent-tinted hover border — role gate, `__manage__` sentinel, and `disabled={!t.active}` behavior all unchanged
- `components/dashboard/date-range-picker.tsx`: trigger is now a `rounded-full bg-card` chip with `font-mono text-[11px] text-primary` — `useDateRangeStore`, presets, and the two-month calendar popover all unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle the sidebar navigation to the prototype's nav treatment** - `083996c` (feat)
2. **Task 2: Restyle the header bar and logo in the tenant layout** - `9425089` (feat)
3. **Task 3: Restyle the header action controls (tenant switcher + date-range chip)** - `89302d7` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `components/layout/sidebar-nav.tsx` - Active nav item translucent lime wash (`bg-primary/10 text-primary font-medium`), `.t-label` section labels, icon opacity states, badge weight normalized
- `app/[tenant-slug]/layout.tsx` - Header `bg-background/95 backdrop-blur-md`, logo `font-extrabold text-[17px]`; auth guard and prop call sites unchanged
- `components/layout/header-actions.tsx` - `gap-2` → `gap-2.5`
- `components/tenants/tenant-switcher.tsx` - `<select>` restyled to `rounded-full bg-card` pill, Syne `font-bold` label
- `components/dashboard/date-range-picker.tsx` - Trigger `Button` restyled to `rounded-full bg-card` mono chip with `text-primary`

## Decisions Made
None - plan executed exactly as written. Every class-string edit matched the plan's literal `<action>` text; no ambiguity encountered.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared chrome (header, sidebar, tenant switcher, date-range trigger) now matches the prototype's tokens and is the base every route under `[tenant-slug]` inherits — Plans 03-06 (per-screen redesigns) build on top of a visually consistent shell
- `HeaderActions`/`SidebarNav` prop signatures verified byte-identical via grep on the exact call-site strings — no downstream plan needs to touch chrome prop wiring
- `npx tsc --noEmit`: clean (same 2 pre-existing baseline `tests/vault-rpc.test.ts` errors as Plan 01)
- `npm run build`: clean, 21 routes generated, no new warnings
- `npx vitest run`: 285 passed / 1 skipped / 5 todo / 1 failed — the 1 failure (`anomaly_alerts` realtime publication delivery test) is the same pre-existing websocket cold-start flake documented in STATE.md since Phase 4 Plan 02 and confirmed unrelated in 12-01-SUMMARY.md; this plan touched zero test/realtime/database files

---
*Phase: 12-redesign-visual*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: components/layout/sidebar-nav.tsx
- FOUND: app/[tenant-slug]/layout.tsx
- FOUND: components/layout/header-actions.tsx
- FOUND: components/tenants/tenant-switcher.tsx
- FOUND: components/dashboard/date-range-picker.tsx
- FOUND: .planning/phases/12-redesign-visual/12-02-SUMMARY.md
- FOUND: 083996c
- FOUND: 9425089
- FOUND: 89302d7
