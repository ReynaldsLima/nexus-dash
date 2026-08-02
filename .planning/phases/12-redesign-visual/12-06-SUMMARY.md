---
phase: 12-redesign-visual
plan: 06
subsystem: ui
tags: [css, tailwind, react-hook-form, settings, badges]

# Dependency graph
requires:
  - phase: 12-01
    provides: ".t-label/.t-heading/.lift/.btn-accent/.input-accent utility classes and --viz-* tokens in app/globals.css"
provides:
  - "Configurações screen (page shell + both connection forms + BackfillWindowControl) restyled into the Phase 12 visual system, extrapolated per 12-CONTEXT.md D-02 (no prototype coverage for this screen)"
  - "Last two emerald-500 ad-hoc Tailwind literals in the codebase eliminated — all connection-status badges now read the semantic --viz-green token"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings screen locked to the .t-heading (18px/700/Syne) typography tier, not .t-display — denser form-heavy content per 12-UI-SPEC.md"
    - "Plain <button className=\"btn-accent ...\"> replaces shadcn <Button> wherever the phase's lime CTA treatment is required; shadcn Button import removed from files where no longer used"

key-files:
  created: []
  modified:
    - "app/[tenant-slug]/settings/page.tsx"
    - "components/settings/backfill-window-control.tsx"
    - "components/settings/meta-ads-form.tsx"
    - "components/settings/google-ads-form.tsx"

key-decisions:
  - "Followed the plan's literal instruction to treat the Meta token <textarea> as the 'Meta token <Input>' referenced in Task 3 step 4 — appended input-accent/rounded-md/bg-secondary to its existing className array rather than skipping it for not being a literal <Input> component, matching both the plan's action text and the threat model's T-12-26 requirement to preserve that array's conditional logic."

patterns-established: []

requirements-completed: [DESIGN-04]

# Metrics
duration: 14min
completed: 2026-08-01
---

# Phase 12 Plan 06: Configurações Screen Restyle Summary

**Settings page shell, both ad-platform connection forms, and the Phase 11 BackfillWindowControl restyled by extrapolation onto Phase 12's token system — zero prototype coverage existed for this screen (D-02), zero behavior/data changes.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-01T23:06:59Z
- **Completed:** 2026-08-01T23:20:03Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- Eliminated the last two `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` ad-hoc literals in the codebase — all three `StatusBadge`/`ChannelStatusBadge` implementations (page-level + both form-level) now render "Conectado" via the semantic `--viz-green` token (`rgba(74,222,128,.12)` background / `rgba(74,222,128,.2)` border), matching the `.bdg-green` values from the prototype
- Settings page header, error-branch heading, both connection cards (`lift hover:ring-primary/20`, `border-b pb-4`, Syne-700 13px titles), and the loading skeleton (`rounded-2xl`) now match the 18px-card/Syne-heading system established by Plans 01-05
- `BackfillWindowControl` (Phase 11, shipped "functional only, sem polimento visual" by design) is now fully restyled: `.t-label` field label, `.input-accent`/`bg-secondary`/`font-mono tabular-nums` input, and a lime `.btn-accent` save button — its optimistic save/revert flow (SET-05 D-03/D-06) is byte-identical
- Both connection forms (`MetaAdsForm`, `GoogleAdsForm`) gained mono field labels, accent-focus secondary-surface inputs, and lime "Conectar …" submit buttons; every Zod schema, `useForm` config, `onSubmit` handler, `ERROR_MESSAGES` map and copy string is unchanged except the single permitted "Status:" → "Status" adjustment (Copywriting Contract carve-out for minor UX polish)

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle the Settings page shell — header, status badges, connection cards** - `86a2481` (feat)
2. **Task 2: Restyle the BackfillWindowControl (SET-03 / SET-05 field)** - `f0e6294` (feat)
3. **Task 3: Restyle the Meta Ads and Google Ads connection forms** - `e663e06` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `app/[tenant-slug]/settings/page.tsx` - `ChannelStatusBadge` semantic `--viz-green`; `.t-heading`/`.t-label` header + error heading; both `<Card>`s get `lift hover:ring-primary/20`, `border-b pb-4`, Syne-700 13px `<CardTitle>`; skeleton `rounded-2xl`
- `components/settings/backfill-window-control.tsx` - `.t-label` field label, `.input-accent`/`bg-secondary`/`font-mono tabular-nums` input, plain `.btn-accent` save button (shadcn `Button` import removed); optimistic save/revert logic untouched
- `components/settings/meta-ads-form.tsx` - Same `StatusBadge` semantic-token treatment, `.t-label` on all 3 field labels + "Status" span, `.input-accent`/`bg-secondary` on all 3 inputs (numeric one also `font-mono tabular-nums`), plain `.btn-accent` submit button (shadcn `Button` import removed); Zod schema, `useForm`, `onSubmit`, copy unchanged
- `components/settings/google-ads-form.tsx` - Same `StatusBadge`/label/input/button treatment for its 2 fields; Zod schema, `useForm`, top-level-navigation `onSubmit`, `ERROR_MESSAGES`/`resolveErrorMessage` unchanged

## Decisions Made
- Task 3's action explicitly labels the Meta token `<textarea>` as the "Meta token `<Input>`" and instructs appending the three restyle literals to its existing `className={[...]}` array while preserving its conditional error-state logic. Executed literally as specified (not skipped for being a `<textarea>` rather than a literal `<Input>` component) — this also satisfies the threat model's T-12-26 requirement that the token field's existing conditional className logic (and thus its visual/structural weight) must not be replaced or weakened.

## Deviations from Plan

None - plan executed exactly as written. All four files match every acceptance criterion (verbatim copy strings, unchanged schemas/resolvers/handlers/queries, exact class strings) on first pass; no bugs, missing functionality, or blocking issues were encountered.

## Issues Encountered
None. One pre-existing, out-of-scope lint error was observed in `components/settings/google-ads-form.tsx` (`react-hooks` "This value cannot be modified" on the pre-existing `window.location.href = ...` top-level-navigation line) — confirmed via `git stash` to already exist identically before this plan's edits (same error, only the line number shifted from 125→121 due to the removed `Button` import). Left untouched per the deviation rules' scope boundary (not introduced or caused by this plan's changes) and per the plan's own explicit instruction not to touch `onSubmit`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 12 (Redesign Visual) is now feature-complete across all 4 target screens + Configurações: Plans 02-06 have applied Plan 01's token/utility contract to Dashboard, Campanhas, Insights, chrome, and now Settings — only Plan 07 (final phase-level polish/verification, per ROADMAP) remains, if scoped.
- `npx tsc --noEmit`: 0 new errors (2 pre-existing `tests/integration/vault-rpc.test.ts` baseline errors only)
- `npm run lint`: 0 errors in any of this plan's 4 modified files (all reported errors/warnings are pre-existing, in unrelated files or unrelated pre-existing lines)
- `npm run build`: compiles cleanly, all 21 routes generated
- `npx vitest run`: 285 passed / 1 skipped / 5 todo / 1 failed — the 1 failure (`anomaly_alerts` realtime publication delivery test) is the same pre-existing websocket cold-start flake documented in STATE.md since Phase 4 Plan 02 and confirmed unrelated in 12-01-SUMMARY.md; this plan touched zero test/realtime/database files

---
*Phase: 12-redesign-visual*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: app/[tenant-slug]/settings/page.tsx
- FOUND: components/settings/backfill-window-control.tsx
- FOUND: components/settings/meta-ads-form.tsx
- FOUND: components/settings/google-ads-form.tsx
- FOUND: .planning/phases/12-redesign-visual/12-06-SUMMARY.md
- FOUND: 86a2481
- FOUND: f0e6294
- FOUND: e663e06
