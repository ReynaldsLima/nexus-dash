---
status: partial
phase: 11-janela-de-hist-rico-retroativo
source: [11-VERIFICATION.md]
started: 2026-07-18T16:10:48.988Z
updated: 2026-07-18T16:10:48.988Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Google Ads OAuth connect with a custom backfill window
expected: `ad_accounts.backfill_days` for that tenant/channel row reflects the chosen value (e.g. 30), not the default 90 — after connecting a real Google Ads account through the actual Google OAuth consent screen with a non-default window.
result: [pending]

### 2. Live Meta Ads connect with a custom backfill window
expected: `ad_accounts.backfill_days` for the meta_ads row reflects the chosen value — after connecting a real Meta Ads account (valid System User token + ad account) with a non-default window.
result: [pending]

### 3. Post-connect inline edit UX (BackfillWindowControl)
expected: Field always editable; "Salvar" appears only on change; on success the field simply reflects the new persisted value (no toast); on failure the field reverts and an inline `role="alert"` error appears.
result: [pending]

### 4. N8N first-sync honoring per-account backfill window
expected: After re-importing/activating both updated workflow JSON files (google-ads-sync.json, meta-ads-sync.json) in the live N8N instance, a first sync for an account with a customized `backfill_days` computes `date_from` from that customized window, not the global constant. Also worth checking while there: `11-REVIEW.md`'s IN-03 note about a pre-existing (out-of-scope) Vault secret naming mismatch that could prevent the sync pipeline from running at all.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
