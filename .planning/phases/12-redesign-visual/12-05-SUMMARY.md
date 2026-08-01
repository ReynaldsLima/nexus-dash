---
phase: 12-redesign-visual
plan: 05
subsystem: ui
tags: [css, tailwind, react, insights, streaming]

# Dependency graph
requires:
  - phase: 12-redesign-visual (Plan 01)
    provides: ".t-label/.t-heading/.t-display/.lift/.btn-accent utility classes and --viz-* tokens in app/globals.css"
provides:
  - "AI Insights screen (InsightCard, page header/CTA/list states, StreamingInsightCard) restyled to prototype tokens"
  - "Insight/streaming badge colour maps (TYPE_CONFIG/IMPACT_CONFIG/STATE_CONFIG) retargeted from stale oklch() literals to prototype .bdg-* rgba values"
affects: [12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Insight/streaming badge pills: inline style={{ background, borderColor, color }} sourced from typed module-level config objects keyed by insight.type/insight.impact/StreamingInsightCardState — never user-derived"

key-files:
  created: []
  modified:
    - "app/[tenant-slug]/insights/page.tsx"
    - "components/insights/streaming-insight-card.tsx"

key-decisions:
  - "None - followed plan as specified"

patterns-established:
  - "Insight cards and the streaming card share one flat .ic shell (rounded-2xl border border-border bg-card p-[22px]); type/impact/state signal lives entirely in a mono badge pill, never in card border/background colour"

requirements-completed: [DESIGN-03]

# Metrics
duration: 9min
completed: 2026-08-01
---

# Phase 12 Plan 05: AI Insights Restyle Summary

**AI Insights screen (insight cards, header/CTA, empty/error states, streaming card) restyled to the prototype's flat card + mono badge pill treatment, with the abort-controlled streaming reader loop, `?trigger=1` auto-invoke, and super_admin redirect left byte-identical.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-01T22:55:00Z (approx, following Plan 04 completion)
- **Completed:** 2026-08-01T23:03:38Z
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments
- `TYPE_CONFIG`/`IMPACT_CONFIG` in `app/[tenant-slug]/insights/page.tsx` retargeted from stale `oklch()` literals to the prototype's exact `.bdg-accent`/`.bdg-red`/`.bdg-amber` rgba values; the coloured 3px left-border + tinted-background card treatment (`borderColor`/`bgColor`) removed entirely
- `InsightCard` restyled to the shared flat `.ic` shell (`rounded-2xl border border-border bg-card` + `.lift` hover-lift), Syne-700 `.t-heading` titles, mono badge pills, `.t-label` metric-chip labels on `bg-secondary`, and Syne-800 metric values
- Insights page header (`.t-display`/`.t-label`), the "Analisar agora" CTA (`.btn-accent`, dropping the `var(--sidebar-primary)` inline style), the empty-state heading (`.t-heading`), the error `<Card>` (`.lift hover:ring-primary/20`), and the mono-11px footer note all restyled
- `StreamingInsightCard`'s `STATE_CONFIG` retargeted to the prototype's `.bdg-accent`/`.bdg-green`/`.bdg-red` values with a `badgeBorder` field added; component shell matches the restyled `InsightCard` (`rounded-2xl border border-border bg-card p-[22px]`), streaming cursor now uses `bg-primary` instead of an inline `style`
- The entire streaming pipeline verified unchanged: `fetch('/api/insights/generate')`, `res.body.getReader()` loop, `AbortController`, `isMountedRef`, the `?trigger=1` auto-invoke effect, and the `role !== 'super_admin'` redirect guard all present byte-identical

## Task Commits

Each task was committed atomically:

1. **Task 1: Retarget TYPE_CONFIG / IMPACT_CONFIG to prototype colours and restyle InsightCard** - `c0301d4` (feat)
2. **Task 2: Restyle the Insights page header, CTA and list states** - `322ae7a` (feat)
3. **Task 3: Restyle the StreamingInsightCard to match the insight-card treatment** - `d240db8` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `app/[tenant-slug]/insights/page.tsx` - TYPE_CONFIG/IMPACT_CONFIG retargeted, InsightCard restyled to `.ic` shell, page header/CTA/empty/error/footer restyled to prototype tokens; streaming logic untouched
- `components/insights/streaming-insight-card.tsx` - STATE_CONFIG retargeted, component shell restyled to match InsightCard, streaming cursor moved from inline style to `bg-primary`; exported type/props unchanged

## Decisions Made
None - plan executed exactly as written. All colour literals, class names, and copy strings matched the plan's provided code verbatim.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All automated verification greps passed on first attempt; `npx tsc --noEmit` showed only the documented baseline 2 `tests/integration/vault-rpc.test.ts` errors (pre-existing, unrelated to this plan); `npm run build` completed cleanly (21 routes); targeted `npx vitest run` on `tests/unit/insights-generate-route.test.ts` and `tests/unit/parse-insight-block.test.ts` passed 17/17 with zero regressions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI Insights screen fully restyled per DESIGN-03; streaming pipeline, trigger effect, and role guard provably unchanged (verified via grep of `AbortController`, `isMountedRef`, `res.body.getReader()`, `searchParams.get('trigger')`, `role !== 'super_admin'`)
- No blockers for Plan 06 (remaining redesign-visual scope)

---
*Phase: 12-redesign-visual*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: app/[tenant-slug]/insights/page.tsx
- FOUND: components/insights/streaming-insight-card.tsx
- FOUND: c0301d4
- FOUND: 322ae7a
- FOUND: d240db8
