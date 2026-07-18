---
phase: 11
slug: janela-de-hist-rico-retroativo
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-18
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client form → Google Ads connect route | `backfillDays` is untrusted browser-supplied query-string input | `backfillDays` (string, coerced) |
| Google OAuth redirect → callback | `backfillDays` leaves and re-enters the app inside the HMAC-signed `state` value | `StatePayload.backfillDays` |
| Client form → Meta Ads connect route | `backfillDays` is untrusted JSON body input | `backfillDays` (number) |
| Client → `updateBackfillWindow` Server Action | Untrusted `tenantId`/`channel`/`days` from the browser; write uses the service-role client (RLS-bypassing) gated by an app-layer authorization check | `{ tenantId, tenantSlug, channel, days }` |
| `ad_accounts` (DB) → N8N sync workflows | `backfill_days` read from a trusted, CHECK-constrained column and used to compute the first-sync date window | `backfill_days` (integer, 7–365) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-01 | Tampering | Signed OAuth state carrying `backfillDays` | mitigate | `backfillDays` lives inside the `StatePayload` object that is JSON-serialized and HMAC-SHA256-signed by `signState` (`lib/google-ads/oauth-state.ts:43-59`); `verifyState` (`:66-87`) recomputes the HMAC with `timingSafeEqual` and returns `null` on any signature mismatch before the payload — including `backfillDays` — is ever trusted. A forged window cannot be injected across the redirect. | closed |
| T-11-02 | Tampering | `ad_accounts.backfill_days` value | mitigate | `CHECK (backfill_days BETWEEN 7 AND 365)` enforced live on the column (`supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql:8-9`), confirmed pushed to the live Supabase project and verified via `information_schema.columns` per `11-01-SUMMARY.md`. Final guard even if all app-layer validation is bypassed. | closed |
| T-11-03 | Tampering | `backfillDays` query param on Google connect route | mitigate | `BackfillDaysSchema = z.coerce.number().int().min(7).max(365).catch(90)` (`app/api/google-ads/connect/route.ts:26`) clamps any missing/malformed/out-of-range value to the safe default 90 before it is ever signed into state. | closed |
| T-11-04 | Elevation of Privilege | `backfillDays` influencing tenant scope (Google) | accept | Confirmed in code: `connect/route.ts` step 5 (`:79-100`) resolves `tenantId`/`tenantSlug` independently of `backfillDays` — for `tenant_admin` exclusively from `getClaims().claims.app_metadata`, for `super_admin` from validated query params. `backfillDays` is parsed at step 4 (`:77`) and only consumed at step 6 (`signState(tenantId, tenantSlug, customerId, backfillDays)`, `:105`) — it never reaches the authorization branch. See Accepted Risks Log AR-11-01. | closed |
| T-11-05 | Tampering | `backfillDays` in Meta POST body | mitigate | `backfillDays: z.number().int().min(7).max(365).default(90)` in `BodySchema` (`app/api/meta-ads/connect/route.ts:28`) rejects out-of-range values via the route's existing 400 path (`safeParse` failure at `:66-70`); DB CHECK (T-11-02) is the final guard. | closed |
| T-11-06 | Elevation of Privilege | `backfillDays` vs tenant scope (Meta) | accept | Confirmed in code: `meta-ads/connect/route.ts` step 3b (`:72-90`) derives `tenantId` for `tenant_admin` exclusively from `getClaims()`, unchanged by this phase's edits — `backfillDays` is destructured separately at step 7 (`:175`) and cannot influence which tenant's row is written. See Accepted Risks Log AR-11-01. | closed |
| T-11-07 | Elevation of Privilege | `tenant_admin` editing another tenant's `backfill_days` | mitigate | `lib/actions/ad-accounts.ts:45-54` — for any role other than `super_admin`, the authoritative tenant is resolved from `getClaims().claims.app_metadata.tenant_id` (never from `getUser()` or the input) and the action rejects with `{ error }` when `claimTenantId !== parsed.data.tenantId`, before the service-role write at `:57-63`. Mirrors the same pattern verified in `app/api/google-ads/connect/route.ts`. | closed |
| T-11-08 | Tampering | Out-of-range days via a crafted Server Action call | mitigate | `updateBackfillSchema` (`lib/actions/ad-accounts.ts:9-14`) enforces `days: z.number().int().min(7).max(365)`; `safeParse` failure at `:30-33` returns `{ error }` before any write. DB CHECK (T-11-02) is the second, independent gate. | closed |
| T-11-09 | Spoofing | Unauthenticated caller invoking `updateBackfillWindow` | mitigate | `lib/actions/ad-accounts.ts:36-40` calls `supabase.auth.getUser()` via the user-session client (`createClient()`, not the service client) and returns `{ error: 'Não autenticado.' }` when `user` is falsy, before `get_user_role()` is even called and before any write. | closed |
| T-11-10 | Tampering | Per-account `backfill_days` used to compute the N8N sync window | accept | `Compute date range` jsCode in both `n8n-workflows/google-ads-sync.json:155` and `n8n-workflows/meta-ads-sync.json:161` reads `$('Loop tenants').item.json.backfill_days ?? $('Set Constants').first().json.BACKFILL_DAYS` — the value originates solely from the CHECK-constrained `ad_accounts.backfill_days` column selected via PostgREST (no untrusted external input reaches this Code node), with the `??` fallback covering null/legacy rows. See Accepted Risks Log AR-11-02. | closed |
| T-11-11 | Denial of Service | Excessively large window causing a large first-sync pull | accept | Window is hard-capped at 365 by the DB CHECK (T-11-02); confirmed the same jsCode only affects the `isFirstSync === true` branch (both files) — `INCREMENTAL_DAYS` (global, unaffected) still governs every subsequent sync. Bounded, single-account, one-time cost. See Accepted Risks Log AR-11-02. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-04, T-11-06 | `backfillDays` is explicitly excluded from every authorization decision in both the Google (`connect/route.ts`) and Meta (`meta-ads/connect/route.ts`) routes — tenant scoping is resolved independently, sourced from `getClaims()` for `tenant_admin` and from validated query/body input for `super_admin` only. A caller can, at most, set an out-of-range-clamped-to-default or in-range window on their own account/tenant; they cannot use `backfillDays` to write to, read, or affect another tenant's row. Risk accepted as documented in `11-02-PLAN.md` and `11-03-PLAN.md`'s `<threat_model>` blocks and reconfirmed against live code during this audit. | Claude (gsd-secure-phase, orchestrator-classified — all evidence code-verifiable, no auditor escalation needed) | 2026-07-18 |
| AR-11-02 | T-11-10, T-11-11 | The N8N `Compute date range` Code node only ever reads `backfill_days` from the PostgREST-selected `ad_accounts` row (itself CHECK-constrained to 7–365) — no external or unauthenticated input path reaches this node. The `?? BACKFILL_DAYS` fallback safely handles null/legacy rows. The worst case (365-day window) is a bounded, one-time cost limited to a single account's first sync; `INCREMENTAL_DAYS` (the recurring, unbounded-frequency path) is untouched and stays global. Risk accepted as documented in `11-05-PLAN.md`'s `<threat_model>` block and reconfirmed against the live workflow JSON during this audit. | Claude (gsd-secure-phase, orchestrator-classified — all evidence code-verifiable, no auditor escalation needed) | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 11 | 11 | 0 | /gsd-secure-phase → gsd-security-auditor (verified all 11 threats against live implementation across `lib/google-ads/oauth-state.ts`, `app/api/google-ads/connect/route.ts`, `app/api/google-ads/callback/route.ts`, `app/api/meta-ads/connect/route.ts`, `lib/actions/ad-accounts.ts`, `supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql`, `n8n-workflows/google-ads-sync.json`, `n8n-workflows/meta-ads-sync.json`; no unregistered threat flags found in any of the 5 plan SUMMARY.md files) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18
