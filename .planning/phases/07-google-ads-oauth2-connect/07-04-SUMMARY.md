---
phase: 07-google-ads-oauth2-connect
plan: 04
subsystem: google-ads-oauth2
tags: [react-hook-form, zod, oauth2, settings-ui, google-ads]

# Dependency graph
requires:
  - phase: 07-google-ads-oauth2-connect
    provides: "Plan 02's GET /api/google-ads/connect (query contract + error codes) and Plan 03's GET /api/google-ads/callback (error codes) as the server contract this UI feeds/displays"
provides:
  - "components/settings/google-ads-form.tsx — GoogleAdsForm client component (Customer ID input, status badge, inline OAuth error, top-level-navigation Connect button)"
  - "Settings page Google Ads card wired to the real OAuth2 flow, replacing the static Developer-Token placeholder"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Top-level window.location.href navigation (not fetch) for OAuth-initiating buttons — required so the browser follows Google's cross-site consent redirect, mirrored from the same constraint documented in Plan 02/03"
    - "Single ERROR_MESSAGES map merging both the connect route's and the callback route's google_error codes into one pt-BR lookup with a generic fallback for unknown codes (D-04, T-07-09 — no server-internal detail ever reaches the UI)"

key-files:
  created:
    - components/settings/google-ads-form.tsx
  modified:
    - app/[tenant-slug]/settings/page.tsx

key-decisions:
  - "GoogleAdsForm mirrors MetaAdsForm's structure (StatusBadge, RHF+zodResolver+zod/v4, destructive/10 role=alert block) but has no token field — the OAuth credential comes from Google's consent screen, not a pasted secret, so the form's only input is the Customer ID and its only action is a top-level navigation, never a fetch POST"
  - "fetchTenantSettings's ad_accounts select widened from 'channel, active' to 'channel, active, account_id' specifically to source the D-06 pre-fill value; Meta Ads path (which doesn't need account_id) is unaffected since the extra column is simply unused there"

requirements-completed: [SET-01]

# Metrics
duration: ~12min
completed: 2026-07-11
---

# Phase 07 Plan 04: Google Ads OAuth2 Connect — Settings UI Wiring Summary

**`GoogleAdsForm` client component (Customer ID input, status badge, inline `?google_error=` alert covering all 10 connect+callback error codes, top-level-navigation Connect button) replaces the static "awaiting Developer Token" placeholder card on the Settings page — SET-01 is now fully code-complete end-to-end.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-11
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `components/settings/google-ads-form.tsx` — `'use client'` component mirroring `MetaAdsForm`'s structure (`StatusBadge`, React Hook Form + `zodResolver` + `zod/v4`, the exact `role="alert"` `bg-destructive/10` error block markup) but adapted for OAuth: a single Customer ID field (client-side regex `/^\d{3}-?\d{3}-?\d{4}$/`, UX-only — the server re-validates identically per Plan 02), pre-filled with `initialCustomerId` when already connected (D-06). On submit, does a **top-level `window.location.href` navigation** (never `fetch`) to `/api/google-ads/connect?customerId=...&tenantId=...&tenantSlug=...`, since the browser must be free to follow Google's cross-site consent redirect. Reads `?google_error=` via `useSearchParams()` and renders it inline using a single `ERROR_MESSAGES` map covering all 7 callback-route codes (`access_denied`, `state_expired`, `no_refresh_token`, `token_exchange_failed`, `vault_write_failed`, `save_failed`, `missing_code`) plus all 3 connect-route codes (`forbidden`, `invalid_customer_id`, `missing_tenant`), with a generic pt-BR fallback for any unrecognized code (T-07-09: no server-internal detail ever reaches the UI).
- `app/[tenant-slug]/settings/page.tsx` — replaced the static Google Ads `<Card>` (the "conexão... será habilitada após a aprovação do Developer Token" placeholder) with one rendering `<GoogleAdsForm tenantId tenantSlug initialStatus initialCustomerId>`, structurally identical to the Meta Ads card. `fetchTenantSettings`'s `ad_accounts` select widened from `channel, active` to `channel, active, account_id`; `AdAccountStatus`/`TenantSettingsData` interfaces extended accordingly; `googleAccountId` derived from the matching `google_ads` row and passed through as the D-06 pre-fill. Meta Ads card left byte-for-byte unchanged.
- `npx tsc --noEmit` clean apart from the 2 pre-existing unrelated `tests/integration/vault-rpc.test.ts` errors (lines 124, 135). `npm run build` succeeds — `/[tenant-slug]/settings` compiles with the new client component alongside all other routes, including both `/api/google-ads/connect` and `/api/google-ads/callback`. Full suite: 29/29 test files, 229 passed / 1 skipped / 5 todo — zero regressions (this plan touches no test files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create components/settings/google-ads-form.tsx** - `0a09200` (feat)
2. **Task 2: Wire GoogleAdsForm into app/[tenant-slug]/settings/page.tsx** - `cd9b45a` (feat)

## Files Created/Modified

- `components/settings/google-ads-form.tsx` - `GoogleAdsForm` client component: Customer ID input, status badge, inline OAuth error block, Connect button (165 lines)
- `app/[tenant-slug]/settings/page.tsx` - Google Ads card replaced with `GoogleAdsForm`; `ad_accounts` select widened to `account_id` for the D-06 pre-fill

## Decisions Made

- Followed the plan's literal reference implementation for both the component and the page wiring verbatim — no structural deviation from the provided code blocks.
- No token/secret field on `GoogleAdsForm` by design (unlike `MetaAdsForm`'s System User token textarea) — the OAuth2 authorization-code flow never has the browser hold a long-lived credential; the only client-supplied value is the Customer ID.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` clean on the first pass (only the 2 pre-existing unrelated `vault-rpc.test.ts` errors); `npm run build` and the full `npx vitest run` suite both passed cleanly with zero regressions on the first run after Task 2.

## User Setup Required

**Deferred infrastructure blocker (D-03), same class as the Phase 2 Developer Token and Plans 02/03's setup notes — code is complete and correct without it; only the live end-to-end round-trip is deferred:**

1. Create the Google Cloud OAuth Client (Web application) and register the redirect URIs — see Plan 02's "User Setup Required" section for the full step list.
2. Set `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` / `GOOGLE_OAUTH_STATE_SECRET` in Vercel (Production + Preview + Development).

Once these exist, the live checkpoint (Connect button → Google consent screen → callback → Settings card shows "Conectado" with the Customer ID pre-filled) can be run manually against Vercel production, per `07-VALIDATION.md`'s Manual-Only row. This is NOT a code gap — it is the same class of external-infrastructure blocker as Phase 2's Google Ads Developer Token and Phase 4's `ANTHROPIC_API_KEY`, and does not block marking SET-01 complete at the code level.

## Next Phase Readiness

- Phase 7 (Google Ads OAuth2 Connect) is now 4/4 plans complete. SET-01 is fully code-complete: `GET /api/google-ads/connect` (Plan 02), `GET /api/google-ads/callback` (Plan 03), and the Settings UI (this plan) all exist and are unit/build/type-check verified.
- SET-01 is marked complete in `.planning/REQUIREMENTS.md` by this plan's `requirements: [SET-01]` frontmatter — the live manual verification (blocked on D-03) is tracked separately in `07-VALIDATION.md`'s Manual-Only row and does not gate this completion, matching the precedent set by Phase 2's Developer Token and Phase 4's `ANTHROPIC_API_KEY` gaps.
- No blockers introduced by this plan.

## Self-Check: PASSED

`components/settings/google-ads-form.tsx` verified present on disk; `app/[tenant-slug]/settings/page.tsx` verified modified. Both task commit hashes (`0a09200`, `cd9b45a`) verified present in git history via `git log --oneline -5`.

---
*Phase: 07-google-ads-oauth2-connect*
*Completed: 2026-07-11*
