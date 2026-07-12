---
phase: 04-ai-insights
plan: 05
subsystem: frontend
tags: [sonner, zustand, supabase-realtime, toast, sidebar-badge]

# Dependency graph
requires:
  - phase: 04-ai-insights (Plan 02)
    provides: "anomaly_alerts table live in production, super_admin-only RLS + supabase_realtime publication membership"
provides:
  - "In-app anomaly toast fired on Realtime INSERT into anomaly_alerts, no polling (AI-04 frontend half)"
  - "Persistent sidebar unread badge on 'AI Insights' nav item, clears on visit"
  - "Single shared Zustand store (useAnomalyAlertsStore) as the sole source of truth for unread count, backing both the toast trigger and the badge"
affects: ["04-ai-insights Plan 06 (daily job — inserts the anomaly_alerts rows this plan's UI reacts to)"]

# Tech tracking
tech-stack:
  added: ["sonner@^2.0.7", "next-themes@^0.4.6"]
  patterns:
    - "Single mounted listener component (AnomalyListener) per tenant layout, not one Realtime subscription per consumer"
    - "toast.custom() with unstyled:true to render a fully custom JSX toast surface (left border accent + whole-body click), not the string-based toast() API"
    - "Zustand singleton store shared across SidebarNav (reads unread, clears on route change) and the Realtime hook (writes unread on INSERT)"

key-files:
  created:
    - components/ui/sonner.tsx
    - lib/stores/anomaly-alerts.ts
    - lib/hooks/use-anomaly-alerts.tsx
    - components/insights/anomaly-listener.tsx
  modified:
    - package.json
    - package-lock.json
    - components/layout/sidebar-nav.tsx
    - app/[tenant-slug]/layout.tsx

key-decisions:
  - "Sonner's generated Toaster reads theme via next-themes' useTheme(); overridden with an explicit theme=\"dark\" prop at the mount point (app/[tenant-slug]/layout.tsx) rather than editing the generated component, since props spread after the internal theme read in components/ui/sonner.tsx"
  - "Resolved tenantId for the Realtime filter by reusing the existing non-super_admin tenants query where present, adding a second minimal query only for the super_admin branch (which previously had none) — avoids a duplicate round-trip for the common case"

patterns-established:
  - "Pattern: shared client-side Zustand store as single source of truth when a Realtime subscription's effect (toast) and its state (badge count) are consumed by two different components — subscribe once, read/write the store everywhere else"

requirements-completed: [AI-04]

# Metrics
duration: 15min
completed: 2026-07-11
---

# Phase 04 Plan 05: In-App Anomaly Alerts (Toast + Sidebar Badge) Summary

**Single Supabase Realtime subscription on `anomaly_alerts` INSERT drives both a `toast.custom()` alert (AlertTriangle icon + 3px `--chart-5` left border, whole-body click-to-navigate) and a persistent Zustand-backed sidebar unread badge that clears when the Super Admin visits the Insights page — no polling.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 completed
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- Installed shadcn's official Sonner (`npx shadcn@latest add sonner`), adding `sonner@^2.0.7` + `next-themes@^0.4.6` and generating `components/ui/sonner.tsx` (`Toaster`)
- `lib/stores/anomaly-alerts.ts` — Zustand singleton (`unread`/`increment`/`clearUnread`), same pattern as `lib/stores/date-range.ts`
- `lib/hooks/use-anomaly-alerts.tsx` — subscribes exactly once per mount to `postgres_changes` INSERT on `anomaly_alerts` (client-side `filter` on `tenant_id`, real access boundary is the super_admin-only RLS policy from Plan 02); on each event, increments the store and fires `toast.custom()` skinned to `var(--chart-5)` (AlertTriangle icon, 3px left border, `unstyled: true`), with both the toast body and the "Ver Insights" button navigating to `/${tenantSlug}/insights` (button `stopPropagation`s first)
- `components/insights/anomaly-listener.tsx` — single mount point (`'use client'`, renders `null`) so there is only ever one active subscription regardless of how many components care about unread count
- `components/layout/sidebar-nav.tsx` — `NavLink` gained an optional `badgeCount` slot (circular pill, `var(--chart-5)` bg/white text, `9+` overflow, conditionally rendered only when `> 0`); a `useEffect` clears the store when `pathname` starts with `/${slug}/insights`
- `app/[tenant-slug]/layout.tsx` — resolves the active tenant's `id` (reusing the existing non-super_admin `tenants` query; added a small second query for the super_admin branch, which previously resolved no tenant row at all), mounts `<Toaster theme="dark" position="top-right" richColors={false} closeButton>` once, and conditionally mounts `<AnomalyListener>` only when `role === 'super_admin'` and a `tenantId` is available
- `npx tsc --noEmit` and `npm run build` both pass (same 2 pre-existing, unrelated `vault-rpc.test.ts` errors as documented in STATE.md since Plan 02)
- Full suite: 23 test files, 179 passed, 1 skipped, 9 todo — the one failure on the combined run (`anomaly_alerts realtime delivery` test in `tests/unit/anomaly-alerts-schema.test.ts`) is the same pre-existing websocket cold-start flake documented in Plan 02's SUMMARY; re-ran isolated → 7/7 passed, confirming no regression from this plan's changes

## Task Commits

1. **Task 1: Install sonner + store + Realtime hook (toast.custom) + listener component** - `db7f2da` (feat)
2. **Task 2: Sidebar badge + clear-on-visit + mount Toaster/AnomalyListener in layout** - `f9221b2` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `components/ui/sonner.tsx` - shadcn-generated `Toaster` (reads theme via `next-themes`, overridden with an explicit prop at the mount point)
- `lib/stores/anomaly-alerts.ts` - Zustand singleton: `unread`, `increment()`, `clearUnread()`
- `lib/hooks/use-anomaly-alerts.tsx` - single Realtime subscription (`postgres_changes` INSERT on `anomaly_alerts`), fires `toast.custom()` with `--chart-5` AlertTriangle accent and whole-body click navigation
- `components/insights/anomaly-listener.tsx` - `'use client'` mount point for the hook, renders `null`
- `components/layout/sidebar-nav.tsx` - badge slot on the `insights` `NavLink`, clear-on-visit effect
- `app/[tenant-slug]/layout.tsx` - resolves `tenantId`, mounts `Toaster` + conditionally mounts `AnomalyListener` for `super_admin`
- `package.json` / `package-lock.json` - added `sonner`, `next-themes`

## Decisions Made

- Overrode Sonner's `theme` at the mount point (`theme="dark"`) instead of hand-editing the generated `components/ui/sonner.tsx`, since the generated component's `{...props}` spread happens after its internal `useTheme()` read — keeps the shadcn-generated file untouched for future `shadcn diff`/updates.
- Reused the existing non-super_admin `tenants` lookup in `app/[tenant-slug]/layout.tsx` for `tenantId` where it already existed, and added a minimal second query only for the super_admin branch (which had none previously) — avoids introducing a duplicate round-trip for the common (non-super_admin) case while still resolving the id needed for the Realtime filter on the super_admin path.

## Deviations from Plan

None in code — plan executed as written; all code blocks in the plan's `<action>` sections were used verbatim (Task 1's hook/store/listener, Task 2's badge/effect/layout wiring).

**Judgment call (not a Rule 1-3 auto-fix): did NOT mark AI-04 as "Complete" in REQUIREMENTS.md.** AI-04's literal wording ("Anomaly detection alerts appear in-app when ROAS drops more than 20% within a 24-hour window") describes an end-to-end behavior spanning two halves: the *detection* half (Plan 06's not-yet-executed N8N daily job, which computes the >20% drop and inserts the `anomaly_alerts` row) and the *delivery* half (this plan — toast + badge react to that row once it exists). This plan only delivers the second half; there is currently no live path that produces a real anomaly row from actual campaign data. Marking AI-04 complete now would misrepresent end-to-end status to a later `/gsd-audit-milestone` run, mirroring the exact judgment-call precedent set in Plan 02's SUMMARY for AI-03/AI-04 and Plan 03's SUMMARY for AI-01. `requirements mark-complete` was deliberately not run for AI-04 this execution; it should only flip once Plan 06 delivers the detection half.

## Issues Encountered

- Full-suite run showed 1 failing test (`anomaly_alerts realtime delivery`, `tests/unit/anomaly-alerts-schema.test.ts`) — this is the exact same pre-existing websocket-cold-start flake documented in Phase 04 Plan 02's SUMMARY ("First combined run... timed out... isolated re-runs... passed"). Re-ran the file in isolation immediately after: 7/7 passed. Not a regression introduced by this plan — no production code in this plan touches `anomaly_alerts` schema, RLS, or realtime publication membership (those are Plan 02's scope); this plan only subscribes to the already-live channel.

## User Setup Required

None. No new environment variables or manual steps — `sonner`/`next-themes` are pure npm dependencies, and the Realtime channel this plan subscribes to was already live and RLS-scoped as of Plan 02.

## Next Phase Readiness

- AI-04's frontend half (in-app toast + persistent badge, no polling) is now live: Plan 06 (daily N8N anomaly-detection job) can insert `anomaly_alerts` rows and this plan's listener will surface them immediately for any signed-in super_admin.
- Manual live verification (per 04-VALIDATION.md — insert a real row, confirm toast+badge appear without refresh, confirm non-super_admin receives nothing over the websocket) is still outstanding and is called out explicitly in the plan's `<verification>` section as a Manual-Only check; not automatable within this execution session (requires a live browser session as a signed-in super_admin plus a manual `anomaly_alerts` INSERT).
- No blockers identified for Plan 06.

---
*Phase: 04-ai-insights*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: components/ui/sonner.tsx
- FOUND: lib/stores/anomaly-alerts.ts
- FOUND: lib/hooks/use-anomaly-alerts.tsx
- FOUND: components/insights/anomaly-listener.tsx
- FOUND: .planning/phases/04-ai-insights/04-05-SUMMARY.md
- FOUND commit: db7f2da (Task 1)
- FOUND commit: f9221b2 (Task 2)
