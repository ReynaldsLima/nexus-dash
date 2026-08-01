---
phase: 12-redesign-visual
plan: 01
subsystem: ui
tags: [css, tailwind, design-tokens, shadcn, card]

# Dependency graph
requires: []
provides:
  - Semantic --viz-blue/green/orange/red/purple data-viz palette in :root and .dark, mirrored as --color-viz-* Tailwind utilities
  - Corrected --chart-2 (#a78bfa) and --chart-3 (#fb923c) to match prototipos/nexus-dash.html
  - Six reusable utility classes (.t-label, .t-heading, .t-display, .lift, .btn-accent, .kpi-glow, .input-accent) in app/globals.css
  - Card primitive at prototype radius (rounded-2xl / 18px) and horizontal padding (px-6 / 24px)
affects: [12-02, 12-03, 12-04, 12-05, 12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 12 CSS utility-class contract: Wave 2 plans (02-06) apply .t-label/.t-heading/.t-display/.lift/.btn-accent/.kpi-glow/.input-accent verbatim, never redefine them"
    - "--kpi-glow-color custom property pattern: consumer sets inline style, .kpi-glow::before reads it via var(--kpi-glow-color, transparent)"

key-files:
  created: []
  modified:
    - app/globals.css
    - components/ui/card.tsx

key-decisions:
  - "Task 3's own automated verify grep (`! grep -q 'px-4'`) is stricter than its acceptance criteria's stated intent ('standalone token') and than its own action instructions, which explicitly require introducing group-data-[size=sm]/card:px-4 in three places. Treated as a plan-authoring bug (Rule 1): implemented the action exactly as specified (verified no bare/standalone px-4 token remains via word-boundary grep), left the plan file itself unmodified."

patterns-established:
  - "D-04 4-weight/3-family typography exception documented inline in globals.css as a comment header, for any future reader tempted to 'simplify' it"

requirements-completed: []  # DESIGN-01..05 intentionally NOT marked complete — their literal wording (REQUIREMENTS.md) requires each screen's visual redesign (Dashboard/Campanhas/Insights/Settings/chrome), delivered by plans 12-02..12-06, not this foundation plan. Same judgment-call precedent as AI-01 (Phase 4 Plan 03) and SET-01 (Phase 7 Plan 03).

# Metrics
duration: 10min
completed: 2026-08-01
---

# Phase 12 Plan 01: Design-Token Foundation Summary

**Semantic --viz-* data-viz palette, six reusable typography/interaction utility classes, and Card primitive radius/padding fix — the interface contract Wave 2 (plans 02-06) consumes verbatim.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-01T22:15:43Z
- **Completed:** 2026-08-01T22:23:36Z
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments
- `app/globals.css` gained a five-token semantic `--viz-*` palette (blue/green/orange/red/purple) in both `.dark` and `:root`, mirrored as `--color-viz-*` in `@theme inline` for Tailwind utility access (`text-viz-blue`, `bg-viz-green/10`, etc.)
- `--chart-2` corrected from `#00d4ff` to `#a78bfa` and `--chart-3` from `#ff6b00` to `#fb923c`, matching `prototipos/nexus-dash.html`'s Meta Ads chart series and warning/orange color exactly
- Six reusable utility classes (`.t-label`, `.t-heading`, `.t-display`, `.lift`, `.btn-accent`, `.kpi-glow`) plus `.input-accent` added to `globals.css`, with the D-04 4-weight/3-family typography exception documented inline
- `components/ui/card.tsx`'s `Card`/`CardHeader`/`CardContent`/`CardFooter` moved from `rounded-xl`/`px-4` (14px/16px) to `rounded-2xl`/`px-6` (18px/24px) — every `<Card>` call site across the app (~20 sites, including `/tenants`/`/agencies`/`/leads` outside this phase's formal scope) inherits the corrected radius/padding centrally

## Task Commits

Each task was committed atomically:

1. **Task 1: Add semantic --viz-* palette and correct --chart-2/--chart-3** - `dfe6fc2` (feat)
2. **Task 2: Add the Phase 12 utility-class layer to globals.css** - `a8884da` (feat)
3. **Task 3: Fix the Card primitive's radius and horizontal padding** - `2651dab` (fix)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `app/globals.css` - Added --viz-* palette (both themes), --color-viz-* Tailwind mirrors, corrected --chart-2/--chart-3, and six Phase 12 utility classes (.t-label/.t-heading/.t-display/.lift/.btn-accent/.kpi-glow/.input-accent)
- `components/ui/card.tsx` - Card/CardHeader/CardContent/CardFooter radius rounded-xl→rounded-2xl, horizontal padding px-4→px-6 (px-3→px-4 on sm variant); no API change, no shadow introduced

## Decisions Made
- Task 3's literal automated `<verify>` command (`! grep -q 'px-4'`) is a substring match that also flags `group-data-[size=sm]/card:px-4`, a token the task's own `<action>` instructions explicitly require introducing in three places (`px-3` → `px-4` on the sm-size variant). This is a self-contradiction in the plan's verification script versus its own action spec and acceptance-criteria wording ("ZERO occurrences of the **standalone** token px-4"). Resolved per deviation Rule 1 (bug in plan tooling, not in code): implemented the action exactly as written, then confirmed via a word-boundary grep (`grep -oE '(^|[ "])px-4([ "]|$)'`) that zero *standalone* `px-4` tokens remain — only the intentionally-added `group-data-[size=sm]/card:px-4` variants exist. `npx tsc --noEmit` and `npm run build` both pass clean, confirming the implementation is correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's Task 3 automated verify script contradicts its own action instructions**
- **Found during:** Task 3 (Fix the Card primitive's radius and horizontal padding)
- **Issue:** The task's `<action>` explicitly instructs changing `group-data-[size=sm]/card:px-3` → `group-data-[size=sm]/card:px-4` in CardHeader, CardContent, and CardFooter. But the task's own `<verify>` automated command runs `! grep -q 'px-4'`, a substring match that fails as soon as any `px-4` appears anywhere in the file — including inside the `group-data-[size=sm]/card:px-4` string the action itself mandates.
- **Fix:** Implemented the action's class-string edits exactly as specified (verbatim). Verified correctness using a precise word-boundary grep (`grep -oE '(^|[ "])px-4([ "]|$)' components/ui/card.tsx`) which confirmed zero standalone `px-4` tokens remain — matching the acceptance criteria's literal wording ("ZERO occurrences of the standalone token px-4"), which is more permissive and consistent with the action than the automated verify grep. Left the plan file itself unmodified (out of scope for the executor to edit).
- **Files modified:** components/ui/card.tsx (no change beyond what the action already specified)
- **Verification:** `npx tsc --noEmit` (clean, only 2 pre-existing baseline `vault-rpc.test.ts` errors) and `npm run build` (clean, 21 routes) both pass; Card export list unchanged (`Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent`)
- **Committed in:** 2651dab (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 plan-verification-script bug, no code impact)
**Impact on plan:** No scope creep. The underlying code change matches the plan's action instructions exactly; only the literal automated verify command in the plan text was overly strict versus its own acceptance criteria and action spec.

## Issues Encountered
None beyond the Task 3 verify-script discrepancy documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Interface contract established: Wave 2 plans (12-02 through 12-06) can now apply `.t-label`/`.t-heading`/`.t-display`/`.lift`/`.btn-accent`/`.kpi-glow`/`.input-accent` classes and `--viz-*`/`--color-viz-*` tokens verbatim without redefining them
- `Card` primitive fix propagates automatically to all ~20 call sites app-wide, including out-of-scope routes (`/tenants`, `/agencies`, `/leads`) per 12-CONTEXT.md's accepted blast-radius note — no visual breakage observed in `npm run build`
- `npx vitest run`: 285 passed / 1 skipped / 5 todo / 1 failed — the 1 failure (`anomaly_alerts` realtime publication delivery test) is the pre-existing websocket cold-start flake documented in STATE.md since Phase 4 Plan 02, unrelated to this plan's CSS/component-class changes (this plan touched zero test files, zero realtime/database code)

---
*Phase: 12-redesign-visual*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: app/globals.css
- FOUND: components/ui/card.tsx
- FOUND: .planning/phases/12-redesign-visual/12-01-SUMMARY.md
- FOUND: dfe6fc2
- FOUND: a8884da
- FOUND: 2651dab
