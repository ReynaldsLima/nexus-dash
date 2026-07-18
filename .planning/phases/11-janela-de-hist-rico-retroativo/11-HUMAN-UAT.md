---
status: testing
phase: 11-janela-de-hist-rico-retroativo
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-SUMMARY.md, 11-05-SUMMARY.md]
started: 2026-07-18T00:00:00.000Z
updated: 2026-07-18T18:40:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 6
name: Live Meta Ads connect with a custom backfill window
expected: |
  `ad_accounts.backfill_days` for the meta_ads row reflects the chosen value — after connecting a real Meta Ads account (valid System User token + ad account) with a non-default window.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pass
notes: Verified via Playwright — killed dev server (nothing was running), started `npm run dev` cold, navigated to localhost:3000, redirected cleanly to /login with no console errors.

### 2. Google Ads Connect Form — Backfill Window Field
expected: On the tenant settings page's Google Ads card, a "Janela de histórico (dias)" number input appears with default value 90, accepting 7-365, with help text clarifying the window only applies to the next first sync. Entering an out-of-range value shows a validation error before submit.
result: pass
notes: Verified via Playwright on wrdigital/lukseg/beta-test — field renders with default 90 and correct help text; entering 400 showed "Máximo de 365 dias" and blocked submission.

### 3. Meta Ads Connect Form — Backfill Window Field
expected: On the tenant settings page's Meta Ads card, the same backfill window number input appears (mirrors Google's — same label, help text, error rendering), default 90, range 7-365.
result: pass
notes: Verified via Playwright — field renders identically to Google's across all 3 tenants (default 90, same label/help text).

### 4. Post-Connect Inline Edit (BackfillWindowControl)
expected: For an already-connected account (Google or Meta), a backfill window field is always editable below the channel's status badge. A "Salvar" button appears only after the value changes. On success, the field simply reflects the new persisted value (no toast). On failure, the field reverts to the prior value and an inline `role="alert"` error message appears.
result: pass
notes: No tenant had a connected account, so a temporary ad_accounts row (wrdigital/google_ads) plus a temporary DB trigger (to force a write failure) were created for this test, then fully removed afterward. Confirmed via Playwright — "Salvar" appears only after edit; save to 45 persisted to the DB with no toast; forced-failure save reverted the field to 45 and showed an inline role="alert" error.

### 5. Live Google Ads OAuth connect with a custom backfill window
expected: `ad_accounts.backfill_days` for that tenant/channel row reflects the chosen value (e.g. 30), not the default 90 — after connecting a real Google Ads account through the actual Google OAuth consent screen with a non-default window.
result: pass
notes: Connected wrdigital/google_ads via the real Google OAuth consent screen in production (nexusdash-chi.vercel.app) with backfillDays=30. Verified live in Supabase: ad_accounts.backfill_days = 30, account_id = 1234567890, active = true. Along the way, fixed two production blockers found during this test: (1) GOOGLE_ADS_CLIENT_ID/SECRET/GOOGLE_OAUTH_STATE_SECRET were missing in Vercel Production env — signState() threw unhandled, causing a 500 on /api/google-ads/connect; (2) the Google Cloud OAuth consent screen was set to "Internal" user type, blocking the personal test account with org_internal — switched to "External" + added test user.

### 6. Live Meta Ads connect with a custom backfill window
expected: `ad_accounts.backfill_days` for the meta_ads row reflects the chosen value — after connecting a real Meta Ads account (valid System User token + ad account) with a non-default window.
result: [pending]

### 7. N8N first-sync honoring per-account backfill window
expected: After re-importing/activating both updated workflow JSON files (google-ads-sync.json, meta-ads-sync.json) in the live N8N instance, a first sync for an account with a customized `backfill_days` computes `date_from` from that customized window, not the global constant. Also worth checking while there: `11-REVIEW.md`'s IN-03 note about a pre-existing (out-of-scope) Vault secret naming mismatch that could prevent the sync pipeline from running at all.
result: [pending]

## Summary

total: 7
passed: 5
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
