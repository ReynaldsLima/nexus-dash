---
phase: 12-redesign-visual
reviewed: 2026-08-05T02:17:44Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/globals.css
  - components/ui/card.tsx
  - app/[tenant-slug]/layout.tsx
  - components/layout/sidebar-nav.tsx
  - components/layout/header-actions.tsx
  - components/tenants/tenant-switcher.tsx
  - components/dashboard/date-range-picker.tsx
  - app/[tenant-slug]/dashboard/page.tsx
  - components/dashboard/ai-shortcut-card.tsx
  - app/[tenant-slug]/campanhas/page.tsx
  - app/[tenant-slug]/insights/page.tsx
  - components/insights/streaming-insight-card.tsx
  - app/[tenant-slug]/settings/page.tsx
  - components/settings/backfill-window-control.tsx
  - components/settings/meta-ads-form.tsx
  - components/settings/google-ads-form.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-05T02:17:44Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 12 visual redesign files (design tokens in `globals.css`, the `Card` primitive, tenant shell layout/nav/header, dashboard/campanhas/insights pages, and the settings connection forms). No security vulnerabilities, hardcoded secrets, or dangerous-function usage were found — the styling changes are additive (Tailwind classes + CSS custom properties) and do not touch data-fetching or auth logic in ways that introduce new risk.

Three logic/error-handling issues are worth fixing (a KPI "0% change" rendered as a decline, an unguarded non-null assertion in the Settings page that can crash on an edge-case `enabled:false` query state, and a missing try/catch in the backfill-window save handler that can leave the button stuck in "saving"). The remaining findings are code-quality/DRY items: one unused import and two instances of near-identical logic duplicated across files.

## Warnings

### WR-01: KPI card renders an unchanged (0.0%) metric as a decline

**File:** `app/[tenant-slug]/dashboard/page.tsx:80-84`
**Issue:** `KpiCard` computes `isGood` and `isUp` purely from `pct > 0` / `pct < 0`. When `pct === 0` (metric unchanged vs. the prior period), both branches of the `positivePolarity` ternary evaluate to `false`, so the badge renders with the "bad" red styling and a down arrow (`isUp` is `false`) even though nothing actually declined.
```tsx
const isGood = hasDelta
  ? (positivePolarity ? pct > 0 : pct < 0)
  : true  // neutro quando sem delta
const isUp = hasDelta && pct > 0
```
**Fix:** Treat `pct === 0` as neutral, matching the existing "sem período anterior" neutral styling:
```tsx
const isNeutral = hasDelta && pct === 0
const isGood = !hasDelta || isNeutral
  ? true
  : (positivePolarity ? pct > 0 : pct < 0)
const isUp = hasDelta && pct >= 0
```
(and render a neutral dash/no-arrow state when `isNeutral` is true, instead of `ArrowDownRight`).

### WR-02: Unsafe `data!` assertion can crash Settings page when the query is disabled

**File:** `app/[tenant-slug]/settings/page.tsx:148-155`
**Issue:** The query is `enabled: !!tenantSlug`. In TanStack Query v5, `isLoading` is `isPending && isFetching` — when the query is disabled, `isFetching` never becomes `true`, so `isLoading` stays `false` even though `data` is still `undefined`. If `tenantSlug` is ever falsy on first render (e.g. `params['tenant-slug']` not yet resolved), execution falls through both the `isLoading` and `isError` guards straight into:
```tsx
const {
  tenantId,
  metaStatus,
  ...
} = data!
```
which throws `Cannot destructure property 'tenantId' of 'data' as it is undefined`.
**Fix:** Guard explicitly instead of asserting:
```tsx
if (isLoading || !data) {
  return (/* SettingsSkeleton */)
}
```

### WR-03: `BackfillWindowControl.onSave` has no error handling for a thrown/rejected action

**File:** `components/settings/backfill-window-control.tsx:35-49`
**Issue:** `onSave` awaits `updateBackfillWindow(...)` and only handles the `{ error }` result shape. If the server action throws or the promise rejects for any other reason (network failure, unexpected server exception), the `catch`-less `await` throws inside the handler: `setSaving(false)` never runs, so the button stays disabled in a permanent "saving" state, and the user gets no error message and no way to retry.
**Fix:**
```tsx
async function onSave() {
  setError(null)
  setSaving(true)
  const previousPersisted = persisted
  setPersisted(value)
  try {
    const result = await updateBackfillWindow({ tenantId, tenantSlug, channel, days: value })
    if ('error' in result) {
      setPersisted(previousPersisted)
      setValue(previousPersisted)
      setError(result.error)
    }
  } catch {
    setPersisted(previousPersisted)
    setValue(previousPersisted)
    setError('Erro de rede. Tente novamente.')
  } finally {
    setSaving(false)
  }
}
```

## Info

### IN-01: Unused import `Badge` in Insights page

**File:** `app/[tenant-slug]/insights/page.tsx:7`
**Issue:** `Badge` is imported from `@/components/ui/badge` but never referenced anywhere in the file (the type/impact chips are built with plain `<span>` elements instead).
**Fix:** Remove the unused import:
```tsx
import { Card, CardContent } from '@/components/ui/card'
```

### IN-02: `StatusBadge`/`ChannelStatusBadge` duplicated across three files

**File:** `components/settings/meta-ads-form.tsx:48-67`, `components/settings/google-ads-form.tsx:70-89`, `app/[tenant-slug]/settings/page.tsx:80-99`
**Issue:** The same connected/invalid/not_configured badge component (same styles, same three branches) is copy-pasted three times with only cosmetic naming differences (`StatusBadge` vs `ChannelStatusBadge`). Any future style or copy change to this status indicator now needs to be applied in three places.
**Fix:** Extract a single shared `ConnectionStatusBadge({ status })` component (e.g. under `components/settings/connection-status-badge.tsx`) and import it in all three call sites.

### IN-03: Duplicated tenant-id resolution branches in tenant layout

**File:** `app/[tenant-slug]/layout.tsx:47-66`
**Issue:** The `role !== 'super_admin'` and `else` branches both run a near-identical `supabase.from('tenants').select('id').eq('slug', urlSlug)...maybeSingle()` query, differing only in the additional `.eq('active', true)` filter and the redirect-on-miss behavior. This is easy to accidentally desync (e.g. a future change to one branch not mirrored in the other).
**Fix:** Consider a small helper that takes `{ requireActive: boolean }` and returns `{ id } | null`, called once, with the redirect decision made by the caller based on role.

### IN-04: "CTR" and "Cliques" KPI cards share the same icon

**File:** `app/[tenant-slug]/dashboard/page.tsx:301-327`
**Issue:** Both the CTR card and the Cliques (clicks) card use `<MousePointerClick className="size-4" />`, making the two adjacent metrics visually indistinguishable at a glance in the 7-card KPI grid, while every other card has a unique icon.
**Fix:** Pick a distinct icon for one of the two (e.g. `Percent` for CTR, keeping `MousePointerClick` for Cliques).

---

_Reviewed: 2026-08-05T02:17:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
