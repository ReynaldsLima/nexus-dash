---
phase: 07
slug: google-ads-oauth2-connect
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-11
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^2.1.9` |
| **Config file** | `vitest.config.mts` (environment: node, setupFiles: `tests/setup.ts`, include: `tests/**/*.test.ts`) |
| **Quick run command** | `npx vitest run tests/unit/google-ads-connect-route.test.ts tests/unit/google-ads-callback-route.test.ts tests/unit/oauth-state.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant single test file(s) above (quick run command), or `npx tsc --noEmit` for the UI tasks (07-04). `npm run build` is NOT a per-task check — a full Next.js production build commonly exceeds the 30s ceiling; it runs at the wave gate only.
- **After every plan wave:** Run `npm test` (full suite) plus `npm run build` (wave-level/phase-gate build check).
- **Before `/gsd-verify-work`:** Full suite must be green; live manual OAuth round-trip explicitly tracked as blocked-pending-infra (Google Cloud OAuth Client not yet created — same precedent as Phase 2's Developer Token and Phase 4's N8N import)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | SET-01 | T-07-01 | Write `oauth-state.test.ts` RED — round-trip (`expired:false`), tampered sig/payload/malformed → null, expired-but-validly-signed → `{expired:true}` (payload preserved, NOT null) | unit | `npx vitest run tests/unit/oauth-state.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 0 | SET-01 | T-07-02 | Write `google-ads-connect-route.test.ts` RED — 401 JSON only for no-user; role/validation/missing-tenant failures redirect to `?google_error=forbidden\|invalid_customer_id`; tenant scope from claims; success builds Google URL (`access_type=offline`+`prompt=consent`+signed `state`) | unit | `npx vitest run tests/unit/google-ads-connect-route.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 0 | SET-01 | T-07-04 / T-07-05 | Write `google-ads-callback-route.test.ts` RED — bad-sig state → `/`; expired-but-valid state → `?google_error=state_expired`; success writes Vault + upserts `ad_accounts` (`active:true`); redirects with `google_error=...` on Google error / failed exchange / missing refresh_token | unit | `npx vitest run tests/unit/google-ads-callback-route.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | SET-01 | T-07-01 | Implement `lib/google-ads/oauth-state.ts` — `signState`/`verifyState` (node:crypto HMAC); `verifyState` returns null on bad-sig/malformed, `{payload,expired}` otherwise → turns 07-01-01 GREEN | unit | `npx vitest run tests/unit/oauth-state.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | SET-01 | — | Add `GOOGLE_OAUTH_STATE_SECRET` (+ OAuth client placeholders) to `.env.local` / `.env.test.example` | config | `grep -q GOOGLE_OAUTH_STATE_SECRET .env.local && grep -q GOOGLE_OAUTH_STATE_SECRET .env.test.example` | N/A | ⬜ pending |
| 07-02-03 | 02 | 1 | SET-01 | T-07-02 | Implement `app/api/google-ads/connect/route.ts` — auth/role/scope gate; failure paths redirect to `/${tenantSlug}/settings?google_error=<code>` (not JSON) when tenant resolvable; success → Google redirect → turns 07-01-02 GREEN | unit | `npx vitest run tests/unit/google-ads-connect-route.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | SET-01 | T-07-01 / T-07-04 / T-07-05 | Implement `app/api/google-ads/callback/route.ts` — verify state (bad-sig → `/`, expired → `state_expired`), exchange code, Vault write, `ad_accounts` upsert (`active:true`), error redirects → turns 07-01-03 GREEN | unit | `npx vitest run tests/unit/google-ads-callback-route.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | SET-01 | T-07-02 / T-07-08 | Create `components/settings/google-ads-form.tsx` — Customer ID input, status badge, inline `google_error` alert (connect + callback codes), top-level Connect navigation | type-check | `npx tsc --noEmit` (filtered for `google-ads-form`) | N/A | ⬜ pending |
| 07-04-02 | 04 | 2 | SET-01 | — | Wire `GoogleAdsForm` into `app/[tenant-slug]/settings/page.tsx` (replace static placeholder; widen select for D-06 pre-fill) | type-check | `npx tsc --noEmit` (build at wave gate) | N/A | ⬜ pending |
| — | — | — | SET-01 | — | Live manual round-trip once the Google Cloud OAuth Client exists | manual-only | — (requires real credentials) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists: ❌ W0 = test file created in Wave 0 (Plan 01) then turned GREEN by the implementing task; N/A = no test file (config/type-check/manual).*

---

## Wave 0 Requirements

- [ ] `tests/unit/oauth-state.test.ts` — sign/verify correctness for the new `state` HMAC helper, incl. bad-sig→null vs expired→`{expired:true}` (no prior equivalent exists)
- [ ] `tests/unit/google-ads-connect-route.test.ts` — auth/role/tenant-scope gate + error-redirect paths for `/api/google-ads/connect`, mirrors `tests/unit/leads-status-route.test.ts`'s mock pattern
- [ ] `tests/unit/google-ads-callback-route.test.ts` — token exchange, Vault write, `ad_accounts` upsert, and error-redirect paths (incl. bad-sig→`/` and expired→`state_expired`)
- Framework install: none — Vitest already configured project-wide

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full browser OAuth round-trip (consent screen → callback → connection shows "Conectado") | SET-01 | Requires a real Google Cloud OAuth Client (`GOOGLE_ADS_CLIENT_ID`/`SECRET`) which does not exist yet (D-03 — infra blocker, same class as the Developer Token) — cannot be automated in CI without live credentials | Once the OAuth Client is created and env vars are set in Vercel: visit `/[tenant-slug]/settings`, enter a real Google Ads Customer ID, click Connect, complete Google's consent screen, confirm redirect back shows "Conectado" and the Customer ID pre-filled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (per-task uses single test files / `tsc --noEmit`; `npm run build` moved to the wave gate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
