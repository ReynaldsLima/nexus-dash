---
phase: 03-dashboard-ui
fixed_at: 2026-06-05T00:00:00Z
review_path: .planning/phases/03-dashboard-ui/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-05
**Source review:** .planning/phases/03-dashboard-ui/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Route handler does not verify caller owns the supplied `tenantId`

**Files modified:** `app/api/meta-ads/connect/route.ts`
**Commit:** 9a7a196
**Applied fix:** Added step 3b after the Zod parse. For `super_admin` callers, `tenantId` from the body is used as before. For `tenant_admin` callers, `tenantId` is derived server-side from `user.app_metadata.tenant_id` (populated by the server-verified `getUser()` response) — the body value is ignored entirely. Returns 403 if `app_metadata.tenant_id` is absent.

---

### CR-02: `GRANT EXECUTE ON ... TO authenticator` exposes `SECURITY DEFINER` Vault function to the PostgREST RPC endpoint

**Files modified:** `supabase/migrations/0014_revoke_authenticator_vault_write.sql` (new compensating migration)
**Commit:** 26c61a6
**Applied fix:** Created migration `0014_revoke_authenticator_vault_write.sql` which issues `REVOKE EXECUTE ON FUNCTION public.create_or_update_vault_secret(TEXT, TEXT) FROM authenticator`. The existing migration 0013 was left untouched as required. The `GRANT TO service_role` from 0013 remains in effect — the Route Handler's service role client can still call the function; the PostgREST RPC endpoint cannot.

---

### WR-01: `app/[tenant-slug]/layout.tsx` uses `getSession()` for authorization — session can be spoofed

**Files modified:** `app/[tenant-slug]/layout.tsx`
**Commit:** 26ac51d
**Applied fix:** Removed the `AppMetadata` type alias, the `decodeClaims()` helper, and the `getSession()` call entirely. `role` and `tokenSlug` are now read directly from `user.app_metadata` (the `user` object is already obtained via `getUser()` — which validates the token server-side — earlier in the same function for the redirect guard).

---

### WR-02: `campaign-aggregation.ts` maps only `'ENABLED'` to `active` — Meta Ads active status is silently mapped to `paused`

**Files modified:** `lib/campaign-aggregation.ts`, `tests/unit/campaign-aggregation.test.ts`
**Commit:** 6eae44d
**Applied fix:** Changed the status ternary at line 82 from `agg.latestStatus === 'ENABLED'` to `(agg.latestStatus === 'ENABLED' || agg.latestStatus === 'ACTIVE')`. Added a new test case `'status ACTIVE (Meta Ads) → active'` to `campaign-aggregation.test.ts` to cover the Meta Ads code path.

---

### WR-03: `computePriorRange` uses a fixed 86400000ms offset, which breaks across DST boundaries

**Files modified:** `lib/dashboard-kpis.ts`
**Commit:** f906881
**Applied fix:** Replaced `new Date(from.getTime() - 86400000)` with `new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1)`. The `Date(year, month, day)` constructor always produces local midnight regardless of DST offset, so the boundary date is always correct. `priorFrom` continues to be computed by subtracting `durationMs` from `priorTo.getTime()` as before.

---

### WR-04: `app/providers.tsx` creates the `QueryClient` as a module-level singleton

**Files modified:** `app/providers.tsx`
**Commit:** 36fcc46
**Applied fix:** Extracted a `makeQueryClient()` factory function, and inside the `Providers` component replaced the module-level constant reference with `const [queryClient] = useState(() => makeQueryClient())`. Because `Providers` is a `'use client'` component, `useState` only runs on the client — one instance per browser tab. The `defaultOptions` (`staleTime: 5min`, `retry: 1`) are preserved unchanged.

---

_Fixed: 2026-06-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
