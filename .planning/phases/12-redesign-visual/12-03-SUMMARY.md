---
phase: 12-redesign-visual
plan: 03
subsystem: ui
tags: [react, tailwind, recharts, dashboard, design-tokens]

# Dependency graph
requires:
  - phase: 12-redesign-visual (Plan 01)
    provides: ".t-label/.t-heading/.t-display/.lift/.btn-accent/.kpi-glow/.input-accent utility classes and --viz-*/--color-viz-* tokens in app/globals.css"
provides:
  - "Dashboard (Overview) restyled to prototype tokens: per-category KPI card treatment (coloured icon glyph, coloured Display value, radial glow, flush bottom bar, hover lift) across all 7 KPI cards"
  - "Locked KPI_CATEGORY map (accent/green/blue/orange) consumed via --kpi-glow-color inline custom property"
  - "Page header (.t-display title, .t-label subtitle), sync pill reusing .logo-dot pulse, chart cards with .lift + border-b headers, DM Mono channel-split legend rows"
  - "AI shortcut card restyled to the shared .btn-accent CTA treatment with a 30x30 accent-tinted icon chip"
affects: [12-04, 12-05, 12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "KpiCategory union + locked KPI_CATEGORY constant pattern: category-driven styling (color/glow/barOpacity) keyed by a closed TypeScript union, never user-controlled — reusable for any future per-category card treatment"

key-files:
  created: []
  modified:
    - "app/[tenant-slug]/dashboard/page.tsx"
    - "components/dashboard/ai-shortcut-card.tsx"

key-decisions:
  - "None - plan executed exactly as written, all literal code blocks applied verbatim"

patterns-established:
  - "Category-colour KPI cards: KpiCategory union ('accent'|'green'|'blue'|'orange') + module-level KPI_CATEGORY record is the reusable shape for any future per-category coloured card; TypeScript closes off the --kpi-glow-color CSS custom property from ever becoming user-controlled"

requirements-completed: [DESIGN-01]

# Metrics
duration: 15min
completed: 2026-08-01
---

# Phase 12 Plan 03: Dashboard (Overview) Restyle Summary

**Dashboard's 7 KPI cards rebuilt to the prototype's per-category treatment (coloured icon glyph, Syne 800 coloured value, radial glow, flush 3px bottom bar, hover lift), page header/sync pill/chart cards/legend promoted to prototype tokens, and the AI shortcut card switched to the shared `.btn-accent` CTA — zero changes to data flow, hooks, Recharts config, or the drill-down sheet.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-01T22:36:29Z (session start, per STATE.md `last_updated`)
- **Completed:** 2026-08-01T22:51:00Z (approx, per last commit timestamp)
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments
- `KpiCard` rebuilt: new `KpiCategory` union (`accent`/`green`/`blue`/`orange`) and locked `KPI_CATEGORY` map drive a category-coloured 30x30 icon chip, `.t-label` label, `.t-display` coloured numeric value, `.kpi-glow` radial glow (via `--kpi-glow-color` inline custom property), `.lift` hover lift, and a flush 3px bottom bar — replacing the old outcome-driven top gradient bar and ad-hoc `oklch()` trend-pill literals
- All 7 KPI card call sites (Gasto Total, ROAS, CPA, CTR, Impressões, Cliques, Conversões) wired to the plan's locked category map (accent/green/blue/accent/orange/blue/green) with zero change to `icon`/`label`/`value`/`pct`/`positivePolarity`/`sub`
- Page title promoted to `.t-display` (main render + error state), subtitle to `.t-label`, sync pill now reuses the existing `.logo-dot` pulsing-dot animation with DM Mono 11px lime text — copy ("Dashboard", "Período atual · 2 canais", "Dados sincronizados") preserved verbatim
- Both chart cards (Gasto por Canal, Split por Canal) gained `.lift hover:ring-primary/20` and `border-b` headers with Syne 700 13px titles; channel-split legend rows switched to DM Mono for value/percentage columns with per-row bottom borders
- AI shortcut card (`ai-shortcut-card.tsx`) switched its CTA to the shared `.btn-accent` treatment, its icon chip to a 30x30 accent-tinted square matching the KPI icon sizing, and its body title to Syne 700 13px — dropping the stale blue `oklch(0.6 0.22 258 / 0.12)` literal and the `var(--sidebar-primary)` inline styles; the `?trigger=1` navigation contract (Phase 4, D-02) untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild the KpiCard component to the prototype's per-category treatment** - `3d25637` (feat)
2. **Task 2: Restyle the page header, sync pill, chart cards and the 7 KpiCard call sites** - `0ca6f71` (feat)
3. **Task 3: Restyle the AI shortcut card to the shared accent-CTA treatment** - `172fa8f` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `app/[tenant-slug]/dashboard/page.tsx` - KpiCard rebuilt with category-driven treatment; page header, sync pill, chart card headers, legend rows restyled; all 7 KpiCard call sites gained `category` prop
- `components/dashboard/ai-shortcut-card.tsx` - CTA switched to `.btn-accent`, icon chip resized/recoloured to 30x30 accent-tinted square, body title promoted to Syne 700 13px

## Decisions Made
None - plan executed exactly as written; every literal code block from the plan's `<action>` sections was applied verbatim.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard (Overview) screen fully restyled per DESIGN-01; `useDashboardData`, `useUserRole`, `aggregateRollups`, `calcDelta`, `computeChannelSplit`, `trendMap` pivot, `CHANNEL_KEY_MAP`, `channelRows`, `<ChannelSheet>`, `spendConfig`/`channelConfig`, and every Recharts prop confirmed byte-for-byte unchanged (grep + `npx tsc --noEmit` + `npm run build` all clean)
- Zero `oklch()` literals remain in either modified file
- `npx tsc --noEmit`: clean apart from the 2 pre-existing unrelated `tests/integration/vault-rpc.test.ts` errors (documented baseline since Phase 4)
- `npm run build`: succeeds, 21 routes compile including `/[tenant-slug]/dashboard`
- `npx vitest run`: 35 test files, 286 passed / 1 skipped / 5 todo, zero regressions (this plan touched zero test files; the previously-documented `anomaly_alerts` realtime websocket cold-start flake did not reproduce this run)
- Ready for Plan 12-04 (next Wave 2 screen restyle)

---
*Phase: 12-redesign-visual*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: app/[tenant-slug]/dashboard/page.tsx
- FOUND: components/dashboard/ai-shortcut-card.tsx
- FOUND: .planning/phases/12-redesign-visual/12-03-SUMMARY.md
- FOUND: 3d25637
- FOUND: 0ca6f71
- FOUND: 172fa8f
