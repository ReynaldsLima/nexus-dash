---
phase: 07-google-ads-oauth2-connect
audited: 2026-07-11
asvs_level: 1
block_on: high
threats_total: 11
threats_closed: 11
threats_open: 0
status: SECURED
---

# Phase 07: Security Audit — Google Ads OAuth2 Connect

Independent verification of the 11-threat register (T-07-01 through T-07-11) against the
current working tree. Implementation files were read-only during this audit; no code was
modified. Evidence is cited by file:line against the actual code, not against summaries/reports.

## Threat Verification

| Threat ID | Category | Component | Disposition | Verdict | Evidence |
|-----------|----------|-----------|-------------|---------|----------|
| T-07-01 | Spoofing/Tampering | OAuth `state` param | mitigate | CLOSED | `lib/google-ads/oauth-state.ts:42-80` — `signState`/`verifyState` use HMAC-SHA256 (`createHmac('sha256', secret())`) with `timingSafeEqual` (line 67) for constant-time signature comparison. `verifyState` returns `null` on missing segment (61), bad signature (67), or unparseable payload (71/78), and returns `{ payload, expired: true }` (75-76) — never `null` — when the signature is valid but `iat` exceeds `STATE_TTL_MS` (10 min, line 5). |
| T-07-02 | Elevation of Privilege | tenant scope in /connect and callback | mitigate | CLOSED | `app/api/google-ads/connect/route.ts:72-90` — for `tenant_admin`, `tenantId`/`tenantSlug` are read exclusively from `supabase.auth.getClaims()` (84-86), never from `req.nextUrl.searchParams`; the query `tenantSlug` is used only to build the pre-auth error redirect (line 48), never for authorization. `super_admin` may target any tenant via validated query params (74-82). Callback (`callback/route.ts:38-39`) derives `tenantId`/`tenantSlug` solely from the HMAC-verified state payload, never from any request query param. |
| T-07-03 | Tampering | auth code interception/replay | mitigate | CLOSED | `app/api/google-ads/callback/route.ts:69,77-90` — `code` is read once, placed directly into the token-exchange POST body, and exchanged immediately server-side over HTTPS (`https://oauth2.googleapis.com/token`). No `console.log`/`console.error` call in the file references `code` (grep-verified — the file's only two `console.error` calls, lines 115 and 129, log `vaultErr?.message` / `upsertErr.message` only). |
| T-07-04 | Information Disclosure | token/code logging | mitigate | CLOSED | Grepped `console\.log` and `console\.error` across `app/api/google-ads/**` and `lib/google-ads/oauth-state.ts`: zero `console.log` calls in any of the 3 files; the only 2 `console.error` calls (`callback/route.ts:115,129`) log a fixed prefix string plus `.message` only — no token, code, or state value is ever interpolated into a log call. |
| T-07-05 | Tampering (data integrity) | missing refresh_token | mitigate | CLOSED | `app/api/google-ads/callback/route.ts:104` — `if (!tokens.refresh_token) return settingsRedirect('no_refresh_token')` runs *before* the Vault write (108) and the `ad_accounts` upsert (118), guaranteeing no partial/silent connect. |
| T-07-06 | Tampering (SSRF) | Google auth host | accept | CLOSED (accepted risk logged below) | `app/api/google-ads/connect/route.ts:108` uses the hardcoded literal `https://accounts.google.com/o/oauth2/v2/auth`; `callback/route.ts:77` uses the hardcoded literal `https://oauth2.googleapis.com/token`. Only validated `customerId`, `signState()` output, and env-sourced `client_id`/`client_secret` are interpolated into query/body — never the host. See Accepted Risks Log. |
| T-07-07 | Information Disclosure | plaintext credential at rest | mitigate | CLOSED | `app/api/google-ads/callback/route.ts:108-127` — `create_or_update_vault_secret` RPC (110-113) is the only place `tokens.refresh_token` is written, and only `vault_secret_id: secretId` (123) is persisted into the `ad_accounts` upsert payload. Grepped for a literal `refresh_token:` key assignment in the upsert object — none found; the legacy plaintext `ad_accounts.refresh_token` column is never referenced in this file. |
| T-07-08 | Input Validation | Customer ID format | mitigate | CLOSED | Server: `app/api/google-ads/connect/route.ts:14-19,64-67` — Zod `CustomerIdSchema` (`/^\d{3}-?\d{3}-?\d{4}$/`, dash-stripped via `.transform`) is authoritative and re-validates independent of the client. Client: `components/settings/google-ads-form.tsx:17-26` mirrors the same regex for UX only; the client also strips dashes before navigating (line 111). |
| T-07-09 | Information Disclosure | error surfacing to UI | accept | CLOSED (accepted risk logged below) | `components/settings/google-ads-form.tsx:32-51` — `ERROR_MESSAGES` is a fixed whitelist mapping known `google_error` codes (both connect- and callback-route codes) to translated pt-BR copy; `resolveErrorMessage` (48-51) falls back to a generic message for any code not in the map. No server-internal detail (stack trace, raw error message, etc.) is ever passed through to the rendered banner. |
| T-07-10 (CR-01, code review) | Tampering/Spoofing | Open Redirect (CWE-601) via unvalidated tenantSlug | mitigate | CLOSED | `lib/google-ads/oauth-state.ts:26-30` — exported `safeTenantSlug()` validates against `/^[a-z0-9-]{2,50}$/` (mirrors the DB `tenants.slug` CHECK constraint), rejecting values like `/evil.com` that would otherwise turn a redirect into a protocol-relative open redirect. Applied at **every** redirect-building call site: `connect/route.ts:48` (query-supplied `tenantSlug` for the error-redirect helper) and `connect/route.ts:79` (`super_admin` path tenantSlug prior to being embedded in the signed state); `callback/route.ts:47` (`settingsRedirect()`, applied to the state-recovered `tenantSlug` before every redirect it builds, success and failure alike). No call site in either route builds a `Location` header from an unvalidated slug. |
| T-07-11 (WR-01, code review) | Elevation of Privilege / Missing Authentication | GET /callback performed privileged writes with no auth check | mitigate | CLOSED | `app/api/google-ads/callback/route.ts:12-25` — the route's first action is `supabase.auth.getUser()`; an unauthenticated caller is redirected to `/` before `state` is even parsed, and before either the Vault RPC or the `ad_accounts` upsert (both service-role, RLS-bypassing) can run. |

## Accepted Risks Log

The following threats carry disposition `accept` per the phase's threat model. Recorded here to close the verification loop (an `accept` disposition requires a logged acceptance, not code evidence):

- **T-07-06** (SSRF via Google auth host): Accepted. The only two external hosts contacted (`accounts.google.com`, `oauth2.googleapis.com`) are compile-time string literals, never influenced by any request input. Residual risk: none identified beyond trusting Google's own infrastructure.
- **T-07-09** (Information disclosure via error surfacing): Accepted. Only a fixed whitelist of translated codes is ever rendered; unrecognized codes fall back to a generic message. Residual risk: none — this is the intended UX design (D-04), not a gap.

## Unregistered Flags

None. No `## Threat Flags` section was present in any of the four phase SUMMARY.md files (07-01 through 07-04), so there is no executor-flagged attack surface outside the 11 registered threats to reconcile.

## Notes / Observations (non-blocking, informational only — not new threats, not scored)

- The code-review's remaining Warning/Info items not tied to a registered threat ID (IN-01 unused `nonce` field, IN-02 no minimum-length check on `GOOGLE_OAUTH_STATE_SECRET`, IN-06 missing test coverage for `save_failed`/super_admin partial-params) were left out of scope per this audit's constraint to verify only the 11 registered threats, not scan for new ones. They do not reopen any of the 11 threats above.
