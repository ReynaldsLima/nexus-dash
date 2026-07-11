---
phase: 07
slug: google-ads-oauth2-connect
status: draft
nyquist_compliant: false
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

- **After every task commit:** Run the relevant single test file(s) above (quick run command)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green; live manual OAuth round-trip explicitly tracked as blocked-pending-infra (Google Cloud OAuth Client not yet created — same precedent as Phase 2's Developer Token and Phase 4's N8N import)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | SET-01 | T-07-01 | `signState`/`verifyState` round-trip; rejects tampered signature; rejects expired payload | unit | `npx vitest run tests/unit/oauth-state.test.ts` | ❌ W0 | ⬜ pending |
| 07-0X-0X | TBD | TBD | SET-01 | T-07-02 | `GET /api/google-ads/connect` rejects unauthenticated/wrong-role callers; resolves tenantId from claims for `tenant_admin`; builds redirect URL with `access_type=offline`+`prompt=consent`+signed `state` | unit | `npx vitest run tests/unit/google-ads-connect-route.test.ts` | ❌ W0 | ⬜ pending |
| 07-0X-0X | TBD | TBD | SET-01 | T-07-03 / T-07-04 | `GET /api/google-ads/callback` rejects invalid/expired `state`; on success writes Vault secret + upserts `ad_accounts` (`active:true`); redirects with `google_error=...` on Google error or failed exchange | unit | `npx vitest run tests/unit/google-ads-callback-route.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | SET-01 | — | Live manual round-trip once the Google Cloud OAuth Client exists | manual-only | — (requires real credentials) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Planner assigns final Task IDs/Plan/Wave numbers — this table's IDs are placeholders reflecting 07-RESEARCH.md's Phase Requirements → Test Map.*

---

## Wave 0 Requirements

- [ ] `tests/unit/oauth-state.test.ts` — sign/verify correctness for the new `state` HMAC helper (no prior equivalent exists)
- [ ] `tests/unit/google-ads-connect-route.test.ts` — auth/role/tenant-scope gate for `/api/google-ads/connect`, mirrors `tests/unit/leads-status-route.test.ts`'s mock pattern
- [ ] `tests/unit/google-ads-callback-route.test.ts` — token exchange, Vault write, `ad_accounts` upsert, and error-redirect paths
- Framework install: none — Vitest already configured project-wide

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full browser OAuth round-trip (consent screen → callback → connection shows "Conectado") | SET-01 | Requires a real Google Cloud OAuth Client (`GOOGLE_ADS_CLIENT_ID`/`SECRET`) which does not exist yet (D-03 — infra blocker, same class as the Developer Token) — cannot be automated in CI without live credentials | Once the OAuth Client is created and env vars are set in Vercel: visit `/[tenant-slug]/settings`, enter a real Google Ads Customer ID, click Connect, complete Google's consent screen, confirm redirect back shows "Conectado" and the Customer ID pre-filled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
