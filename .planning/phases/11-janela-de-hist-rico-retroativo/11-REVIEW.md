---
phase: 11-janela-de-hist-rico-retroativo
reviewed: 2026-07-17T18:30:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - app/[tenant-slug]/settings/page.tsx
  - app/api/google-ads/callback/route.ts
  - app/api/google-ads/connect/route.ts
  - app/api/meta-ads/connect/route.ts
  - components/settings/backfill-window-control.tsx
  - components/settings/google-ads-form.tsx
  - components/settings/meta-ads-form.tsx
  - lib/actions/ad-accounts.ts
  - lib/google-ads/oauth-state.ts
  - n8n-workflows/google-ads-sync.json
  - n8n-workflows/meta-ads-sync.json
  - supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql
  - tests/unit/ad-accounts-actions.test.ts
  - tests/unit/google-ads-callback-route.test.ts
  - tests/unit/google-ads-connect-route.test.ts
  - tests/unit/meta-ads-connect-route.test.ts
  - tests/unit/oauth-state.test.ts
  - types/database.types.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-17T18:30:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 11 adds a per-account "janela de histórico retroativo" (`backfill_days`, 7–365, default 90) across the OAuth state, the connect/callback routes, the `updateBackfillWindow` server action, the settings UI, and the N8N sync workflows. The security-sensitive plumbing (HMAC-signed OAuth state carrying `backfillDays`, `safeTenantSlug` open-redirect guard, tenant-scoping via verified JWT claims, Vault-based secret storage) is solid and well covered by the added unit tests — no critical or security-severity issues were found in the reviewed diff.

The issues found are all logic/UX gaps around how the new `backfill_days` value is kept in sync between the DB and the client after it's first set: the reconnect flow can silently reset a previously customized window back to the default, `revalidatePath` in the server action doesn't actually invalidate the client-side cache the Settings page reads from, and there's a defensive-programming gap in the inline editor's save handler and in the Settings page's query-disabled edge case. None of these block correctness of the happy path exercised by the new tests, but they should be addressed before this ships.

One additional item is noted for visibility only: a pre-existing (not introduced by this phase) mismatch between the Vault secret name written by the connect routes and the name the N8N workflows try to read. See IN-03 below — it is out of scope for this phase's diff (confirmed via `git diff`, which shows only the `backfill_days` lines changed in the two workflow JSON files) and is flagged only so it isn't lost.

## Warnings

### WR-01: Reconnecting an already-configured account silently resets its customized backfill window to the default

**File:** `components/settings/google-ads-form.tsx:113`, `components/settings/meta-ads-form.tsx:87`, `app/[tenant-slug]/settings/page.tsx:174, 202-207`
**Issue:** `GoogleAdsForm` and `MetaAdsForm` are the same forms used both for the *initial* connect and for *reconnecting* an account whose token has gone `invalid` (the badge/status logic in `page.tsx` renders them unconditionally, and `BackfillWindowControl` is rendered alongside them once `status !== 'not_configured'`). Both forms hard-code `defaultValues: { ..., backfillDays: 90 }` and neither receives the tenant's already-persisted `googleBackfillDays` / `metaBackfillDays` (fetched in `page.tsx`'s `fetchTenantSettings` but only ever passed to `BackfillWindowControl`, never to `GoogleAdsForm`/`MetaAdsForm`). Consequence: a tenant_admin who previously set the window to e.g. 30 days via `BackfillWindowControl`, and later has to reconnect the same account because the token expired, will submit the connect form with `backfillDays` defaulted back to 90 unless they remember to re-type 30 — and the callback/connect route's upsert (`onConflict: 'tenant_id,channel'`) overwrites `backfill_days` unconditionally, silently discarding the customization. Note this only affects *future* first-syncs so it's not data loss, but it is a surprising, silent regression of a value the user explicitly set.
**Fix:** Thread the current value through, e.g.:
```tsx
// page.tsx
<GoogleAdsForm
  tenantId={tenantId}
  tenantSlug={tenantSlug}
  initialStatus={googleStatus}
  initialCustomerId={googleAccountId}
  initialBackfillDays={googleBackfillDays}
/>
```
```tsx
// google-ads-form.tsx
interface GoogleAdsFormProps {
  // ...
  initialBackfillDays?: number
}
// ...
defaultValues: { customerId: initialCustomerId ?? '', backfillDays: initialBackfillDays ?? 90 }
```
Apply the same pattern to `MetaAdsForm`/`meta-ads-form.tsx`.

### WR-02: `revalidatePath` in `updateBackfillWindow` has no effect on the data the Settings page actually reads

**File:** `lib/actions/ad-accounts.ts:67`
**Issue:** `SettingsPage` (`app/[tenant-slug]/settings/page.tsx`) is a `'use client'` component that fetches its data with `useQuery` (TanStack Query, `staleTime: 5min`) via the browser Supabase client — it never uses Next.js's `fetch`/Data Cache or a Server Component render for this data. `revalidatePath('/${tenantSlug}/settings')` invalidates the Next.js Router/Full Route Cache, which is not the cache this page's visible values come from. Net effect: after a successful save, if the user navigates away and back to Settings within the 5-minute `staleTime` window (or another tab/session re-renders `BackfillWindowControl` with the cached `initialDays` prop), the UI can show the stale pre-save value even though the DB was updated correctly — contradicting the component's own `initialDays` prop contract. The current single-page session experience is masked by `BackfillWindowControl`'s local optimistic state, so this is easy to miss in manual testing.
**Fix:** Either invalidate the actual client cache key instead of/in addition to `revalidatePath` (e.g., expose a `queryClient.invalidateQueries({ queryKey: ['settings', tenantSlug] })` call triggered from `BackfillWindowControl` after a successful save — this requires either lifting `updateBackfillWindow`'s call site to a client hook that owns the query client, or dropping `revalidatePath` since it's a no-op here), or migrate this page's initial data fetch to a Server Component / route handler that `revalidatePath` actually affects.

### WR-03: `BackfillWindowControl.onSave` has no error handling around the awaited server action

**File:** `components/settings/backfill-window-control.tsx:36-50`
**Issue:** `onSave` calls `await updateBackfillWindow(...)` with no `try/catch`. `updateBackfillWindow` is written to always return `{ ok }` or `{ error }` rather than throw, but Next.js Server Actions can still reject the promise on transport-level failures (network drop, connection reset, server action de-serialization/framework errors) that never reach the function body. If that happens here, the `await` rejects, `setSaving(false)` at the bottom of the function never runs, and the control is left in `saving: true` forever (Save button — if it were still rendered — would stay disabled), with no error message shown to the user. Compare with `MetaAdsForm.onSubmit`, which wraps its network call in `try/catch` specifically to cover this case.
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

### WR-04: `data!` non-null assertion in `SettingsPage` can throw when the query is disabled

**File:** `app/[tenant-slug]/settings/page.tsx:115-148`
**Issue:** `useQuery` is configured with `enabled: !!tenantSlug`. In TanStack Query v5, `isLoading` is defined as `isPending && isFetching`; when a query is disabled, `isFetching` is `false`, so `isLoading` is also `false` even though `status` is still `'pending'` and `data` is `undefined`. If `tenantSlug` is ever falsy on a render (e.g. `useParams()` momentarily returning an empty value, or this component being reused in a context where the route param isn't yet populated), execution falls through both the `isLoading` and `isError` guards straight to `const { tenantId, ... } = data!`, which throws `Cannot destructure property 'tenantId' of 'undefined'`. In normal `[tenant-slug]` routing this is unlikely to trigger today, but the `data!` assertion means the "disabled query" case has no defined behavior and will hard-crash the page rather than showing the skeleton or an error state.
**Fix:** Add an explicit branch (or fold it into the loading check) for the disabled/no-data case:
```tsx
if (isLoading || (!tenantSlug && !data)) {
  return (/* skeleton */)
}
```
or check `!data` before destructuring and render the skeleton/error state instead of asserting non-null.

## Info

### IN-01: `updateBackfillWindow` doesn't verify the update actually matched a row

**File:** `lib/actions/ad-accounts.ts:58-65`
**Issue:** The `.update(...).eq('tenant_id', ...).eq('channel', ...)` call is not followed by a `.select()` / row-count check, so if no `ad_accounts` row exists for that `tenant_id` + `channel` (e.g. a race with the account being disconnected in another session), Supabase returns no error and the action still returns `{ ok: true }`, giving the user a false "saved" signal for a write that touched zero rows. Low practical impact today since the control is only rendered when the channel is already connected, but worth hardening since it's a service-role write bypassing RLS.
**Fix:** Add `.select('tenant_id')` and check the returned array length, returning `{ error: 'Conta não encontrada.' }` when it's empty.

### IN-02: Default backfill window (90) is a duplicated magic number across 5+ call sites

**File:** `app/api/google-ads/connect/route.ts:26`, `app/api/meta-ads/connect/route.ts:28`, `components/settings/google-ads-form.tsx:113`, `components/settings/meta-ads-form.tsx:87`, `app/[tenant-slug]/settings/page.tsx:181, 214`
**Issue:** The default value `90` and the bounds `7`/`365` are repeated verbatim in the Zod schemas, the form default values, the DB `CHECK` constraint, and the fallback expressions — six independent places that must all be kept in sync if the default or bounds ever change.
**Fix:** Extract shared constants (e.g. `export const BACKFILL_DAYS_DEFAULT = 90`, `BACKFILL_DAYS_MIN = 7`, `BACKFILL_DAYS_MAX = 365` in a small shared module) and reference them from both the Zod schemas and the UI defaults.

### IN-03: Pre-existing Vault secret naming mismatch (not introduced by this phase — flagged for visibility)

**File:** `app/api/google-ads/callback/route.ts:109`, `app/api/meta-ads/connect/route.ts:150`, `n8n-workflows/google-ads-sync.json` ("Read vault secret" node body), `n8n-workflows/meta-ads-sync.json` ("Read vault secret" node body)
**Issue:** The connect/callback routes write the refresh token / System User token under `create_or_update_vault_secret` names `google_ads_token_${tenantId}` and `meta_ads_token_${tenantId}` (keyed by tenant UUID). The N8N sync workflows' "Read vault secret" node instead requests `tenant_${tenant_slug}_google_refresh_token` / `tenant_${tenant_slug}_meta_system_token` (keyed by tenant slug, different prefix/suffix convention). These names never match, so `read_vault_secret` would return nothing for the sync workflows regardless of `backfill_days`. This predates Phase 11 — `git diff` for the two workflow files in this phase touches only the `select=...,backfill_days,...` query param and the `backfill_days ?? BACKFILL_DAYS` fallback line — but it will silently break the entire sync pipeline this feature depends on, so it's worth surfacing even though it's out of this phase's scope.
**Fix (tracked separately from Phase 11):** Align the secret-name convention on both sides — either have the connect/callback routes name the secret `tenant_${tenantSlug}_google_refresh_token` / `tenant_${tenantSlug}_meta_system_token`, or update the N8N workflows to look up the secret by the `vault_secret_id` UUID already returned in the `ad_accounts` select (which the workflows already fetch but currently ignore in the "Read vault secret" node).

---

_Reviewed: 2026-07-17T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
