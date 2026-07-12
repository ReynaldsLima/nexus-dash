---
phase: 03-dashboard-ui
plan: 02
subsystem: ui/providers
tags: [tanstack-query, zustand, date-range-picker, shadcn, providers, header]
dependency_graph:
  requires:
    - lib/stores/date-range.ts (from Plan 01)
    - components/ui/button.tsx (pre-existing)
    - components/tenants/tenant-switcher.tsx (pre-existing)
    - components/auth/logout-button.tsx (pre-existing)
  provides:
    - app/providers.tsx (QueryClientProvider singleton)
    - components/ui/popover.tsx (shadcn Popover via @base-ui/react)
    - components/ui/calendar.tsx (shadcn Calendar via react-day-picker v10)
    - components/ui/sheet.tsx (shadcn Sheet via @base-ui/react)
    - components/dashboard/date-range-picker.tsx (global date picker wired to Zustand)
    - components/layout/header-actions.tsx (client wrapper for header interactives)
  affects:
    - app/layout.tsx (Providers wraps TenantStoreProvider)
    - app/[tenant-slug]/layout.tsx (HeaderActions replaces inline TenantSwitcher+LogoutButton)
    - Plans 03-03 through 03-05 (QueryClientProvider available; DateRangePicker in header)
tech_stack:
  added:
    - "@tanstack/react-query@^5.101.0"
    - "react-day-picker@^10.0.1 (installed by shadcn calendar)"
  patterns:
    - QueryClient module singleton (created outside component to prevent cache recreation)
    - Zustand module singleton store (no Provider needed for client-side in-memory state)
    - Server Component layout delegates client interactives to 'use client' wrapper
    - Intl.DateTimeFormat pt-BR for date label formatting (no date-fns dependency)
key_files:
  created:
    - app/providers.tsx
    - components/ui/popover.tsx
    - components/ui/calendar.tsx
    - components/ui/sheet.tsx
    - components/dashboard/date-range-picker.tsx
    - components/layout/header-actions.tsx
  modified:
    - app/layout.tsx (added Providers wrapper)
    - app/[tenant-slug]/layout.tsx (replaced TenantSwitcher+LogoutButton with HeaderActions)
    - components/ui/button.tsx (updated by shadcn CLI)
    - package.json (added @tanstack/react-query, react-day-picker)
decisions:
  - react-day-picker v10 installed (shadcn CLI pinned ^10.0.1, not v9 as researched) — classNames API changed 'table' to 'month_grid'; fixed inline
  - Intl.DateTimeFormat used for date label instead of date-fns format() — avoids adding dependency
  - PopoverTrigger render prop pattern used (consistent with @base-ui/react dialog.tsx pattern)
  - onOpenChange receives (open, eventDetails) in @base-ui/react — used arrow fn (isOpen) => setOpen(isOpen) to discard eventDetails
  - Sheet uses @base-ui/react/dialog (not Radix) — Plan 04 must use base-ui dismiss patterns, not onPointerDownOutside/onInteractOutside from RESEARCH.md Pattern 5
metrics:
  duration_minutes: 25
  completed_date: "2026-06-04"
  tasks_total: 2
  tasks_completed: 2
  files_created: 6
  files_modified: 4
requirements: [DASH-04]
---

# Phase 3 Plan 02: TanStack Query Provider + DateRangePicker Summary

**One-liner:** QueryClientProvider singleton wired into root layout, three shadcn components added (Popover, Calendar, Sheet via @base-ui/react), and a global DateRangePicker in the tenant header that reads/writes the Zustand date-range store — unblocking all TanStack Query hooks for Plans 03/04/05.

## What Was Built

### app/providers.tsx
New `'use client'` component exporting `Providers` wrapper. `QueryClient` created as module singleton (outside component) with `staleTime: 5min, retry: 1`. Wraps children in `QueryClientProvider`. Root `app/layout.tsx` now nests `<Providers><TenantStoreProvider>`.

### components/ui/popover.tsx + calendar.tsx + sheet.tsx
Three shadcn components added via `npx shadcn add popover calendar sheet`. All use `@base-ui/react` as the primitive layer (consistent with existing `dialog.tsx`). `react-day-picker@10.0.1` installed as peer dependency of Calendar.

**Important for Plan 04 (Sheet drill-down):** `sheet.tsx` is built on `@base-ui/react/dialog`, NOT Radix UI. The RESEARCH.md Pattern 5 (`onPointerDownOutside`/`onInteractOutside`) is specific to Radix — those props do not exist on `SheetPrimitive.Popup`. Base UI's equivalent for preventing dismiss on outside click must be implemented via `modal` prop or custom backdrop logic when Plan 04 addresses D-11.

### components/dashboard/date-range-picker.tsx
`'use client'` component wired to `useDateRangeStore`. Features:
- Controlled `Popover` (`open` state via `useState`)
- Left panel: 5 preset buttons (last7/last14/last30/thisMonth/lastMonth) calling `applyPreset(key)` and closing the popover
- Right panel: `<Calendar mode="range" selected={{ from, to }} onSelect={handleSelect} numberOfMonths={2} />`
- Button label shows `dd/MM – dd/MM` via `Intl.DateTimeFormat('pt-BR')` — no date-fns dependency
- Range selection completes when both `from` and `to` are defined → writes to store and closes popover

### components/layout/header-actions.tsx
`'use client'` wrapper component that colocates `DateRangePicker`, `TenantSwitcher`, and `LogoutButton`. Solves the Server Component / Zustand boundary (RESEARCH.md Pitfall 4): `app/[tenant-slug]/layout.tsx` remains a Server Component while all interactive elements are in this client wrapper.

### app/[tenant-slug]/layout.tsx refactored
Removed inline `<TenantSwitcher />` and `<LogoutButton />` from header. Replaced with `<HeaderActions role={role} tenants={tenants} activeSlug={urlSlug} />`. Removed now-unused imports of `LogoutButton` and `TenantSwitcher`; kept `type TenantOption` import (used by `loadTenantsForSwitcher`).

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | a77231a | feat(03-02): install TanStack Query, shadcn popover/calendar/sheet, create Providers |
| Task 2 | 426729e | feat(03-02): create DateRangePicker, HeaderActions and wire into tenant layout |

## Decisions Made

1. **react-day-picker v10 installed (not v9)** — shadcn CLI installed `^10.0.1` instead of the v9 researched. The classNames object renamed `table` to `month_grid` in v10. Fixed inline in `calendar.tsx`. The `mode="range"` API, `DateRange` type, and `selected`/`onSelect` props remain compatible.
2. **Intl.DateTimeFormat instead of date-fns** — Plan explicitly forbids installing date-fns. `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })` produces identical `dd/MM` output without the dependency.
3. **Sheet uses @base-ui/react, not Radix** — RESEARCH.md Pattern 5 references Radix `onPointerDownOutside`/`onInteractOutside` props. These do not exist on Base UI's `Dialog.Popup`. Plan 04 (Campaign Sheet D-11: prevent close on outside click) must use Base UI's `modal` prop or a custom approach — documented as a known deviation for Plan 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed react-day-picker v10 classNames API mismatch**
- **Found during:** Task 1, TypeScript check after installing shadcn components
- **Issue:** `shadcn add calendar` installed `react-day-picker@10.0.1`. The generated `calendar.tsx` used `classNames.table` which was renamed to `classNames.month_grid` in v10, causing `error TS2353: Object literal may only specify known properties, and 'table' does not exist in type 'Partial<ClassNames>'`
- **Fix:** Renamed `table: "w-full border-collapse"` to `month_grid: "w-full border-collapse"` in `components/ui/calendar.tsx`
- **Files modified:** `components/ui/calendar.tsx`
- **Commit:** a77231a (included in Task 1 commit)

## Known Stubs

None. This plan creates infrastructure (providers, components) with no data rendering or stub values. No hardcoded empty values flow to UI.

## Threat Flags

None. Verified against plan threat model:
- T-03-02-01 (QueryClient bundle): Confirmed — `queryClient` stores no secrets, only caches RLS-authorized responses.
- T-03-02-02 (DateRangePicker/HeaderActions): Accepted — date range is a UI filter only, not a security input. RLS enforces tenant isolation independently of the date range value.

## Self-Check: PASSED

Files exist:
- FOUND: app/providers.tsx
- FOUND: components/ui/popover.tsx
- FOUND: components/ui/calendar.tsx
- FOUND: components/ui/sheet.tsx
- FOUND: components/dashboard/date-range-picker.tsx
- FOUND: components/layout/header-actions.tsx

Commits exist:
- FOUND: a77231a (Task 1)
- FOUND: 426729e (Task 2)
