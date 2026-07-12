---
phase: 04-ai-insights
fixed_at: 2026-07-11T14:31:18Z
review_path: .planning/phases/04-ai-insights/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-07-11T14:31:18Z
**Source review:** .planning/phases/04-ai-insights/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 5 warning — `fix_scope: critical_warning`, IN-01 excluded)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: XSS via `dangerouslySetInnerHTML` rendering AI-generated metric value

**Files modified:** `app/[tenant-slug]/insights/page.tsx`
**Commit:** 9b26309
**Applied fix:** Replaced `<span dangerouslySetInnerHTML={{ __html: m.value }} />` with plain JSX text rendering `<span>{m.value}</span>`, matching every other rendered field on `AiInsight`. Removes the stored-XSS path where a maliciously-named campaign or model hallucination could inject `<script>`/`onerror` markup into `ai_insights.metrics[].value`.

### WR-01: Insert failures on `ai_insights` are silently swallowed (daily route)

**Files modified:** `app/api/insights/daily/route.ts`
**Commit:** e1547ac
**Applied fix:** Captured the `{ error }` from the `ai_insights` insert; on failure, logs via `console.error` and returns `{ ok: false, error }` with HTTP 500 instead of a blind 200, so N8N's error-workflow/retry logic and the daily audit trail can see the failure.

### WR-02: Insert failures on `ai_insights` are silently swallowed (generate route `onFinish`)

**Files modified:** `app/api/insights/generate/route.ts`
**Commit:** 1df5c1a
**Applied fix:** Captured the `{ error }` from the `onFinish` insert and log it via `console.error` when present, giving server-side visibility into lost on-demand analyses (the response is already streamed to the client by the time `onFinish` runs, so this is the only observability point left for that failure mode).

### WR-03: AI Insights UI reachable by non-super_admin roles despite AI-03's "super_admin only" scope

**Files modified:** `components/layout/sidebar-nav.tsx`, `app/[tenant-slug]/dashboard/page.tsx`, `app/[tenant-slug]/insights/page.tsx`, `lib/hooks/use-user-role.ts` (new)
**Commit:** 2040017
**Applied fix:**
- Added `lib/hooks/use-user-role.ts`, a client-side hook wrapping the same `get_user_role()` RPC already used server-side, to let client-rendered page components (which can't receive the `role` prop `TenantLayout` resolves via `getClaims()` the way `SidebarNav`/`HeaderActions` do) gate their own UI.
- `sidebar-nav.tsx`: changed the nav filter from `role === 'agency'` (which only stripped the item for `agency`) to `role !== 'super_admin'`, so `tenant_admin` and `viewer` no longer see the "AI Insights" link either.
- `dashboard/page.tsx`: `<AiShortcutCard>` is now conditionally rendered only when `role === 'super_admin'` (fetched via the new hook).
- `insights/page.tsx`: added a role-resolved redirect (`router.replace` to the tenant dashboard) for any non-`super_admin` role, with the page rendering `null` while role is loading or once redirect is in flight, mirroring the `role === 'super_admin'` gate `layout.tsx` already applies to `AnomalyListener`.
- This closes the authorization/UX gap while RLS and route-level auth (already correct per the review) remain the actual data-access boundary.

### WR-04: Shared-secret comparison is not constant-time

**Files modified:** `app/api/insights/daily/route.ts`
**Commit:** bc2de22
**Applied fix:** Added a `safeCompare()` helper using `node:crypto`'s `timingSafeEqual` (with an explicit length check first, since `timingSafeEqual` throws on mismatched buffer lengths rather than returning false) and replaced the `!==` comparison of `x-n8n-secret` against `N8N_INSIGHTS_SECRET` with it, removing the timing side-channel.

### WR-05: Streaming fetch loop has no cleanup on unmount

**Files modified:** `app/[tenant-slug]/insights/page.tsx`
**Commit:** ac0adb6
**Applied fix:** Added an `AbortController` (aborted on unmount via a cleanup `useEffect`) wired into the `fetch()` call's `signal`, plus an `isMountedRef` guard checked before every `setStreamState`/`setStreamedText` call, before scheduling/running the completion `setTimeout`/`refetch()`, and inside the reader loop (which also calls `reader.cancel()` if unmount is detected mid-stream). `AbortError` is treated as a silent no-op in the catch block rather than surfacing as `streamState: 'error'`.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-11T14:31:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
