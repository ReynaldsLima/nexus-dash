# Phase 7: Google Ads OAuth2 Connect - Research

**Researched:** 2026-07-11
**Domain:** OAuth2 web-server flow (Google Identity Platform), Next.js 15/16 Route Handlers, Supabase Vault credential storage
**Confidence:** HIGH (OAuth2 endpoints/params, Node crypto, existing codebase patterns) / MEDIUM (exact production redirect URI, Vercel domain to register)

## Summary

This phase adds two GET Route Handlers (`/api/google-ads/connect`, `/api/google-ads/callback`) that implement Google's standard OAuth2 **web server flow** for the `https://www.googleapis.com/auth/adwords` scope, mirroring the existing Meta Ads System User token flow's auth/authorization/Vault/upsert pattern. No new npm dependency is required: the authorization URL is a plain `URLSearchParams`-built string, the token exchange is a raw `fetch()` POST (same style as `app/api/meta-ads/connect/route.ts`), and the `state` param is signed/verified with Node's built-in `crypto` module (`createHmac`/`timingSafeEqual`) — the project has no JWT library installed and one isn't needed for a single-purpose, short-lived, server-signed-and-verified token.

The two Google-documented parameters that matter most for this phase's UX requirement (D-02: "active immediately", D-05: reconnect always overwrites) are `access_type=offline` (required to receive a `refresh_token` at all) and `prompt=consent` (required to force a **fresh** `refresh_token` on every reconnect, not just the first-ever consent — Google only returns `refresh_token` on first consent unless `prompt=consent` forces the consent screen again). Both must always be present in the authorization URL for this phase's reconnect-without-confirmation UX to work correctly every time, not just once.

A codebase-specific integration risk was found that isn't mentioned in the phase's prior research: `proxy.ts`'s middleware matcher covers **all** non-public paths, including `/api/*`, and redirects to `/login` whenever `supabase.auth.getUser()` returns no user. Both new routes will pass through this middleware. This is expected to work transparently (Supabase's default cookie `SameSite=Lax` is sent on top-level GET navigations, which is exactly what Google's redirect to `/api/google-ads/callback` is), but it must be verified live since it's untested for this specific cross-site-redirect-then-GET-route-handler shape in this codebase.

**Primary recommendation:** Two `runtime = 'nodejs'` GET Route Handlers, no new npm packages, hand-rolled HMAC-SHA256 `state` (JSON payload + signature, base64url-encoded, ~10 min expiry) signed with a new `GOOGLE_OAUTH_STATE_SECRET`, raw `fetch()` for the token exchange (never `google-auth-library`'s `OAuth2Client` — keeps this phase's code style consistent with the Meta pattern it mirrors), `access_type=offline&prompt=consent` always set, and `ad_accounts` upserted with `active: true` immediately on successful token exchange (no Google Ads API validation call, per D-02).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Customer ID is captured BEFORE the OAuth redirect, in the same Settings card. On "Conectar", Customer ID + tenantId are embedded in the signed `state` param — no server-side session storage, no second post-callback form.
- **D-02:** No Google Ads API call (e.g. `ListAccessibleCustomers`) validates the Customer ID or token — impossible without an approved Developer Token. The flow trusts the OAuth token exchange succeeding: if the exchange succeeds, `ad_accounts.active = true` is set immediately. This differs explicitly from Meta, which validates against the Graph API before persisting; Google has no such step in this phase, by technical necessity not design choice.
- **D-03:** No Google Cloud OAuth Client exists yet (confirmed via grep — `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET` absent everywhere). Treated as an infrastructure blocker, same class as the Developer Token and the N8N System User. Code must be complete and correct but only works live once the user creates the OAuth Client and sets `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET` in Vercel (Production + Preview + Development) with the exact redirect URI registered in Console. Register as a Deferred/Blocker item, not a blocking task.
  - Note: the Google Cloud project's OAuth consent screen is already in "Production" mode (per STATE.md Resolved Questions) — this avoids the 7-day refresh-token expiry that applies in "Testing" mode. A new OAuth **Client** (Web application type) created under this same project should inherit that Production status; confirm this when the Client is created.
- **D-04:** OAuth errors (consent denied; invalid/expired/adulterated `state`) redirect to `/[tenant-slug]/settings?google_error=...` with inline error display, mirroring `MetaAdsForm`'s `role="alert"` block. No toast, no dedicated error page.
- **D-05:** Reconnecting overwrites the existing row via `upsert` with `onConflict: 'tenant_id,channel'` — identical to Meta's pattern. No confirmation dialog.
- **D-06:** The Customer ID input is pre-filled with the currently-connected `account_id` when status is `'connected'` — mirrors `MetaAdsForm` keeping `accountId` visible after connecting.
- **D-07:** The OAuth `state` param is signed using a NEW dedicated env var (e.g. `GOOGLE_OAUTH_STATE_SECRET`) — never reusing `SUPABASE_SERVICE_ROLE_KEY` or any other existing secret. Must be added to Vercel alongside `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`.

### Claude's Discretion

- Exact `state` payload format (JWT-style vs simple HMAC + base64) and expiration/nonce anti-replay mechanism.
- Exact route naming — `03-CONTEXT.md` D-15 already anticipated `/api/google-ads/connect` (initiates redirect) and `/api/google-ads/callback` (exchanges the code).
- Client-side Customer ID format validation (regex `\d{3}-\d{3}-\d{4}` vs digits-only, dash normalization before sending).
- Exact authorization URL parameters (`access_type=offline`, `prompt=consent` — this research confirms both are required, see Common Pitfalls).
- Exact form structure (React Hook Form + Zod), reusing `Card`/`Input`/`Label`/`Button` already used in `MetaAdsForm`.

### Deferred Ideas (OUT OF SCOPE)

- Real Google Ads API sync/reporting calls, campaign data ingestion, N8N workflow changes — depends on Developer Token approval, is Phase 2's job (already code-complete, awaiting the token).
- Active Customer ID validation via `ListAccessibleCustomers` or any Google Ads API call — impossible without the Developer Token; revisit once approved.
- A "Disconnect" button — Meta's flow doesn't have one today; don't add it asymmetrically for Google Ads only.
- MCC/Manager Customer ID support (`login-customer-id` header, account hierarchy) — out of scope; v1 assumes one Google Ads account per tenant, same `UNIQUE(tenant_id, channel)` limitation as Meta.

</br>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| SET-01 | Tenant Admin can connect a Google Ads account to their tenant via OAuth2 flow | Authorization URL/params confirmed (§Code Examples #1); token exchange endpoint/response confirmed (§Code Examples #2); `state` HMAC sign/verify pattern using built-in `crypto` (§Code Examples #3); Vault write + `ad_accounts` upsert reuses the exact `create_or_update_vault_secret` RPC and `onConflict: 'tenant_id,channel'` pattern already proven by Meta's route; redirect URI registration and Customer ID format requirements documented (§Common Pitfalls, §Environment Availability) |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| Node `crypto` (built-in) | Node 20/22 runtime (Vercel) | Sign/verify the OAuth `state` param (HMAC-SHA256 + timing-safe compare) | Zero new dependency; stable, unchanged API [CITED: nodejs.org/api/crypto.html] |
| `fetch` (global) | Node 18+ built-in | POST to `https://oauth2.googleapis.com/token` for the code→token exchange | Matches the exact style already used in `app/api/meta-ads/connect/route.ts` for Meta Graph API calls — no new abstraction for a two-call OAuth flow [VERIFIED: codebase] |
| `zod` (already installed) | `^4.4.3` (`zod/v4` import) | Validate the Customer ID input client- and server-side | Already the project's form/body validation standard [VERIFIED: package.json, meta-ads route] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `google-auth-library` | `^10.9.0` (already installed, verified current on npm registry) | Has an `OAuth2Client` class with `generateAuthUrl()`/`getToken()` that could implement this flow | **Not recommended for this phase** — see Alternatives Considered. Already used elsewhere in the codebase (`lib/sheets.ts`) but for a Service Account JWT flow, not this authorization-code flow. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch()` for URL-building + token exchange | `google-auth-library`'s `OAuth2Client.generateAuthUrl()` / `.getToken()` | `OAuth2Client` reduces boilerplate for URL param encoding and error parsing, and is already an installed dependency (zero added weight). But it introduces an inconsistent code style vs. the Meta route's raw-`fetch` pattern for what is fundamentally two simple HTTP operations (build a URL, POST a form). Recommendation: raw `fetch`/`URLSearchParams`, consistent with the existing codebase convention for this exact class of problem (third-party OAuth-adjacent HTTP calls). Either choice is technically sound — flag to planner as a legitimate discretion point if consistency-with-Meta is not prioritized. |
| Hand-rolled HMAC `state` | A JWT library (`jose`, `jsonwebtoken`) | Neither is installed; adding one for a single, short-lived, server-signed-and-server-verified token (never parsed by a third party) is unjustified — HMAC + `timingSafeEqual` is the complete correct primitive for this exact "only my own server ever validates this" case. This is the "Don't Hand-Roll" section's one exception: hand-rolling here is the *right* call, not a shortcut — a generic JWT lib would add unnecessary surface (alg confusion, audience/issuer claims that don't apply) for a problem that doesn't need it. |

**Installation:**
```bash
# No new packages required for this phase.
```

**Version verification:**
```bash
npm view google-auth-library version
# → 10.9.0 (matches package.json's ^10.9.0 — already current)
```

## Architecture Patterns

### Recommended Project Structure

```
app/
├── api/
│   └── google-ads/
│       ├── connect/
│       │   └── route.ts        # GET — auth+role+tenant scope check (mirrors Meta), builds signed state, redirects to Google
│       └── callback/
│           └── route.ts        # GET — verifies state, exchanges code, writes Vault + ad_accounts, redirects to settings
├── [tenant-slug]/
│   └── settings/
│       └── page.tsx            # replace static Google Ads card (lines ~159-181) with GoogleAdsForm + connect button
components/
└── settings/
    └── google-ads-form.tsx      # mirrors meta-ads-form.tsx — Customer ID input, status badge, inline error, "Conectar" button
lib/
└── google-ads/
    └── oauth-state.ts           # signState()/verifyState() — HMAC-SHA256, base64url payload, expiry+nonce
```

### Pattern 1: Authorization Request (GET `/api/google-ads/connect`)

**What:** Verify the caller is authenticated and has `tenant_admin`/`super_admin` role (same RPC/claims pattern as Meta's route), resolve the authoritative `tenantId` server-side (never trust a client-supplied one for `tenant_admin`), read the submitted Customer ID from the query string, sign a `state` payload containing `{ tenantId, customerId, nonce, iat }`, then `NextResponse.redirect()` to Google's authorization endpoint.

**When to use:** Every time the user clicks "Conectar Google Ads" (including reconnects — D-05).

**Example:**
```typescript
// Source: developers.google.com/identity/protocols/oauth2/web-server (verified via WebFetch, 2026-07-11)
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

const params = new URLSearchParams({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  redirect_uri: `${baseUrl}/api/google-ads/callback`,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/adwords',
  access_type: 'offline',   // REQUIRED — without this, no refresh_token is ever returned
  prompt: 'consent',        // REQUIRED — without this, refresh_token is ONLY returned on the user's
                            // very first-ever consent for this client; every reconnect needs a NEW
                            // refresh_token per D-05's "overwrite, no confirmation" UX
  state: signedState,       // HMAC-signed, see Pattern 3
})

return NextResponse.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`)
```

### Pattern 2: Token Exchange (GET `/api/google-ads/callback`)

**What:** Verify `state` (signature + expiry), extract `tenantId`/`customerId`, exchange the `code` query param for tokens, write the `refresh_token` to Vault, upsert `ad_accounts`, redirect back to Settings.

**Example:**
```typescript
// Source: developers.google.com/identity/protocols/oauth2/web-server (verified via WebFetch, 2026-07-11)
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    redirect_uri: `${baseUrl}/api/google-ads/callback`,
    grant_type: 'authorization_code',
  }),
})

if (!tokenRes.ok) {
  // Never log the raw response body (may contain error detail derived from user input echo)
  const url = new URL(`/${tenantSlug}/settings`, baseUrl)
  url.searchParams.set('google_error', 'token_exchange_failed')
  return NextResponse.redirect(url)
}

const tokens = await tokenRes.json() as {
  access_token: string
  refresh_token?: string   // present because access_type=offline + prompt=consent were both set
  expires_in: number
  scope: string
  token_type: string
}

if (!tokens.refresh_token) {
  // Defensive: should not happen given prompt=consent, but Google's own docs warn this can still
  // occur in edge cases (e.g. Google-side outage returning a degraded grant) — treat as a hard error,
  // never silently persist a connection with only an access_token (it expires in 3600s and Phase 2's
  // N8N sync depends on a durable refresh_token in Vault).
}

// vault + ad_accounts upsert: identical shape to app/api/meta-ads/connect/route.ts steps 6-7,
// using service.rpc('create_or_update_vault_secret', { p_name: `google_ads_token_${tenantId}`, p_secret: tokens.refresh_token })
// then service.from('ad_accounts').upsert({ tenant_id, channel: 'google_ads', account_id: customerId,
//   vault_secret_id: secretId, active: true }, { onConflict: 'tenant_id,channel' })
```

### Pattern 3: Signed `state` (HMAC-SHA256, no new dependency)

**What:** A self-contained, server-signed, server-verified token carrying `tenantId`, `customerId`, and CSRF/replay protection (`nonce` + `iat` timestamp checked against a ~10 minute expiry window at verify time).

**Example:**
```typescript
// lib/google-ads/oauth-state.ts
// Source: nodejs.org/api/crypto.html (verified via WebFetch, 2026-07-11) — createHmac/timingSafeEqual
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface StatePayload {
  tenantId: string
  customerId: string
  nonce: string
  iat: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signState(tenantId: string, customerId: string): string {
  const payload: StatePayload = {
    tenantId,
    customerId,
    nonce: randomBytes(16).toString('hex'),
    iat: Date.now(),
  }
  const payloadB64 = base64url(JSON.stringify(payload))
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET!
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  return `${payloadB64}.${signature}`
}

export function verifyState(state: string): StatePayload | null {
  const [payloadB64, signature] = state.split('.')
  if (!payloadB64 || !signature) return null

  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET!
  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url')

  // timingSafeEqual requires equal-length buffers — mismatched lengths mean invalid signature
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as StatePayload
    if (Date.now() - payload.iat > STATE_TTL_MS) return null // expired
    return payload
  } catch {
    return null
  }
}
```

### Anti-Patterns to Avoid

- **Trusting `state` without verifying HMAC + expiry:** an unsigned or replayable `state` lets an attacker link a tenant they don't control to their own Google account's `refresh_token`, or replay an old authorization code exchange. Always verify signature AND `iat` freshness before trusting the payload.
- **Writing `refresh_token` to `ad_accounts.refresh_token` (the legacy plaintext column):** migration `0006`'s own comment says this column is legacy and must move to Vault. Only populate `vault_secret_id`.
- **Calling `getUser().app_metadata` for tenant scope:** per the codebase's own documented regression (STATE.md, `agency-app-metadata-getuser-mismatch`), this does NOT reflect Custom Access Token Hook claims for non-`super_admin` roles. Always use `getClaims()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vault secret storage | A custom encryption/decryption scheme for the refresh_token | `create_or_update_vault_secret` RPC (already exists, tested by Meta's flow) | Reuses a proven, SECURITY DEFINER-gated, `service_role`-only function — no new attack surface. |
| OAuth2 authorization/token endpoints | A generic "OAuth client" abstraction layer | Google's documented endpoints directly via `fetch` | The flow is exactly two HTTP calls (build a URL, POST a token exchange) — an abstraction layer adds indirection without solving a real problem at this scale (2 routes, 1 provider). |
| CSRF/replay protection for `state` | A generic session-store-backed anti-CSRF token system | Self-contained signed `state` (HMAC + expiry, Pattern 3) | D-01 already decided no server-side session storage is used; a signed, self-verifying token is the correct minimal primitive that satisfies both CSRF protection and payload integrity without added infra. |

**Key insight:** This phase is small in scope (2 routes, 1 external provider, no complex data model) — the risk here is *not* under-building (missing a needed abstraction) but *over-building* (adding a JWT library, a generic OAuth client wrapper, or session-based state storage that the phase's own locked decisions (D-01, D-07) already ruled out).

## Common Pitfalls

### Pitfall 1: `redirect_uri` must match EXACTLY, including path and trailing slash

**What goes wrong:** Google returns `redirect_uri_mismatch` if the `redirect_uri` sent in both the authorization request AND the token exchange request doesn't byte-for-byte match one of the URIs registered for the OAuth Client in Google Cloud Console (scheme, host, path, trailing slash, and case must all match).
**Why it happens:** Developers often register `https://domain.com/api/google-ads/callback` but the app builds the URL with a trailing slash, a different case, or (in preview/local dev) a different host.
**How to avoid:** Compute `redirect_uri` from a single source of truth (e.g. one shared constant/helper deriving from `request.nextUrl.origin` or an explicit `NEXT_PUBLIC_APP_URL` env var), use it identically in both `/connect` (auth request) and `/callback` (token exchange), and register the exact production value plus the local dev equivalent (e.g. `http://localhost:3000/api/google-ads/callback`) in Google Cloud Console. **Confirm the actual stable production domain before registering** — STATE.md references two different Vercel URLs (a deployment-specific alias captured during Phase 0 provisioning, and `https://nexusdash-chi.vercel.app` used repeatedly for live Phase 6 UAT) — verify with the user which one is the actual custom/production domain to register (flagged as an open question below).
**Warning signs:** `redirect_uri_mismatch` error from Google, visible only in the `error` query param on the callback redirect — must be surfaced via D-04's inline error block, not swallowed.

### Pitfall 2: `refresh_token` is only issued once per user+client unless `prompt=consent` forces re-consent

**What goes wrong:** Without `prompt=consent`, a user reconnecting (D-05) may get a token exchange response with `access_token` but no `refresh_token` — because Google only issues a `refresh_token` on the user's first-ever grant for this OAuth Client (or after the grant is revoked). Silently accepting that response would either crash (accessing `.refresh_token` on `undefined`) or, worse, silently keep the OLD refresh_token in Vault while showing "connected" — a stale-credential bug that's invisible until the old token eventually fails.
**Why it happens:** This is Google's documented, deliberate behavior, not a bug — but it's easy to test only the *first* connection (where it always works) and never a *reconnect*, missing the gap in QA.
**How to avoid:** Always send both `access_type=offline` AND `prompt=consent` (never conditionally omit `prompt=consent` for "returning" users) — this guarantees a fresh `refresh_token` on literally every authorization, matching D-05's "reconnect overwrites, no confirmation" requirement. Additionally, treat a token-exchange response missing `refresh_token` as a hard error (redirect with `google_error=no_refresh_token`), never a silent partial success.
**Warning signs:** A reconnect flow that reports "Conectado" but the underlying Vault secret is unchanged from before.

### Pitfall 3: `proxy.ts` middleware intercepts ALL non-public paths, including these two new `/api/*` routes

**What goes wrong:** `proxy.ts`'s matcher (`'/((?!_next/static|_next/image|favicon.ico|...).*)'`) covers every route except static assets — there is no `/api` exclusion. It calls `supabase.auth.getUser()` and redirects to `/login` whenever no user is found. Both `/api/google-ads/connect` (same-origin GET, triggered by a button/link click) and `/api/google-ads/callback` (cross-site GET, triggered by Google's redirect after consent) pass through this middleware before the route handler ever runs.
**Why it happens:** This is by design for protecting pages, but nobody has previously exercised this exact shape (an external provider's top-level GET redirect landing on a Route Handler) — the existing Meta flow is a same-origin `fetch()` POST from an already-loaded authenticated page, a different cookie-delivery scenario than a cross-site top-level navigation.
**How to avoid:** This should work transparently because Supabase's `@supabase/ssr` cookies default to `SameSite=Lax` (no override found in this codebase — `lib/supabase/server.ts`/`client.ts` don't set `sameSite` explicitly) and `Lax` cookies ARE sent on cross-site top-level GET navigations (exactly this case). But this must be verified LIVE against the actual Vercel deployment before considering the phase done — if the session cookie is somehow not delivered on the Google→callback redirect, the user gets silently bounced to `/login` instead of seeing D-04's inline error, which would be a confusing dead end.
**Warning signs:** After granting consent on Google's screen, the user lands on `/login` instead of `/[tenant-slug]/settings` with either a success badge or an inline error.

### Pitfall 4: Google Ads Customer ID format vs. Meta's Account ID format

**What goes wrong:** Meta's `accountId` uses an `act_` prefix; Google Ads Customer IDs are a bare 10-digit number, commonly displayed with dashes (`XXX-XXX-XXXX`) but must be normalized to digits-only before use as `ad_accounts.account_id` (or stored consistently one way — pick digits-only to match what the eventual Google Ads API calls expect as `customer_id`). Reusing Meta's exact regex/transform logic verbatim would silently accept/reject the wrong format.
**Why it happens:** Copy-pasting the Meta form's Zod schema without adapting the account-ID shape.
**How to avoid:** Validate as `/^\d{3}-?\d{3}-?\d{4}$/`, then `.replace(/-/g, '')` to normalize before sending to the server and before storing in `account_id`. Confirm both client and server schemas normalize identically (server must not trust the client already stripped dashes).
**Warning signs:** A tenant reconnecting with dashes in the field creates an `account_id` value inconsistent with a previous connection that had no dashes, defeating `onConflict: 'tenant_id,channel'`'s upsert-by-identity semantics if `account_id` itself were ever used as a lookup key elsewhere (it currently isn't — `channel` + `tenant_id` is the conflict target — but inconsistent storage is still a data-quality issue when the Developer Token is later approved and real API calls need a clean `customer_id`).

### Pitfall 5: Never log the authorization `code`, `access_token`, or `refresh_token`

**What goes wrong:** A `console.error` that includes the full token response (common when debugging a failed exchange) leaks a durable credential into Vercel's log retention.
**Why it happens:** Copy-pasting a debug `console.log(tokens)` during development and forgetting to remove it, or logging an error object that happens to include the request body.
**How to avoid:** Follow the Meta route's exact convention — log only `error.message`/a fixed string, never the full response body or any token value. This project's `code_review` step (standard depth) should specifically grep for `console.` calls near token-handling code in this phase's routes.

## Code Examples

### 1. Full authorization URL parameters (verified against official docs)

| Param | Value | Required | Why |
|-------|-------|----------|-----|
| `client_id` | `process.env.GOOGLE_ADS_CLIENT_ID` | Yes | Identifies the OAuth Client [CITED: developers.google.com/identity/protocols/oauth2/web-server] |
| `redirect_uri` | `{baseUrl}/api/google-ads/callback` | Yes | Must exactly match a URI registered in Google Cloud Console |
| `response_type` | `code` | Yes | Web server flow always uses the authorization-code grant |
| `scope` | `https://www.googleapis.com/auth/adwords` | Yes | The single scope needed for Google Ads API access |
| `access_type` | `offline` | Yes (for this phase) | Without it, no `refresh_token` is ever returned |
| `prompt` | `consent` | Yes (for this phase, always) | Forces a fresh `refresh_token` on every authorization, required by D-05 |
| `state` | HMAC-signed payload (Pattern 3) | Yes (project decision D-01/D-07) | Carries `tenantId`+`customerId` and provides CSRF/replay protection |

### 2. Token exchange response shape (verified against official docs)

```json
{
  "access_token": "ya29....",
  "expires_in": 3600,
  "refresh_token": "1//...",
  "scope": "https://www.googleapis.com/auth/adwords",
  "token_type": "Bearer"
}
```
`refresh_token` is present only when `access_type=offline` was set on the authorization request AND either this is the first-ever grant for this user+client, or `prompt=consent` forced re-consent [CITED: developers.google.com/identity/protocols/oauth2/web-server].

## State of the Art

Not applicable in the traditional sense — Google's web-server OAuth2 flow has been stable since its introduction and is not undergoing a deprecation cycle (unlike, e.g., the Google Ads REST API version churn tracked in Phase 2's research). No "old vs. new approach" table is needed for this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The new OAuth Client (Web application type) created under the project's existing Google Cloud project will inherit the project's "Production" (not "Testing") publishing status | User Constraints / D-03 note | If it does NOT inherit Production status, refresh_tokens issued would expire after 7 days (same Pitfall as Phase 2's A6) — would silently break connections a week after every (re)connect until noticed |
| A2 | `@supabase/ssr`'s auth cookies use the library default `SameSite=Lax` in this project (no override found in `lib/supabase/`) | Common Pitfalls #3 | If cookies are actually `Strict` or otherwise not sent on Google's cross-site redirect to `/api/google-ads/callback`, `proxy.ts` would redirect the user to `/login` instead of completing the connection — must be verified live |
| A3 | `https://nexusdash-chi.vercel.app` is the correct, stable production domain to register as the redirect URI (vs. the deployment-specific alias captured in STATE.md's Phase 0 infra section) | Common Pitfalls #1 | Registering the wrong domain causes a hard `redirect_uri_mismatch` failure for every real user, not just an edge case |
| A4 | A single `google_ads_token_{tenantId}` Vault secret name (mirroring Meta's `meta_ads_token_{tenantId}` convention) is an acceptable naming scheme, with no collision risk between channels for the same tenant | Pattern 2 | Low risk — names are already channel-prefixed so no collision, but confirm the planner adopts this exact naming for consistency with `read_vault_secret`/N8N lookups Phase 2 already expects |

**None of these are HIGH-risk blockers** — A1 and A3 should be confirmed by the user when the Google Cloud OAuth Client is actually created (already tracked as the D-03 infrastructure blocker); A2 should be confirmed via one live manual test once the OAuth Client exists.

## Open Questions (RESOLVED)

1. **Which Vercel domain is the actual stable production URL to register in Google Cloud Console?**
   - What we know: STATE.md's Phase 0 infra section lists `https://nexus-dash-h39vlzi71-riguettilimatech-8948s-projects.vercel.app`; the same file's Phase 6 UAT entries repeatedly reference `https://nexusdash-chi.vercel.app` for live testing.
   - What's unclear: Whether the first is a frozen deployment-specific alias (common with Vercel's auto-generated preview URLs) and the second is the actual assigned production/custom domain, or vice versa.
   - Recommendation: Confirm with the user (or via Vercel dashboard/`vercel domains ls`) before documenting the redirect URI to register — this is purely an infra/documentation question, not a code-blocking one, since the code should read the origin dynamically (`request.nextUrl.origin` or an env var) rather than hardcode a domain.
   - **RESOLVED:** Both routes compute `redirect_uri` from `req.nextUrl.origin` dynamically (Plan 02 `/connect` step 6, Plan 03 `/callback` step 7), so no domain is hardcoded — this sidesteps the code question entirely. The remaining action (which exact Vercel domain to register in Google Cloud Console) is a pure infra/documentation step under the D-03 OAuth-Client blocker, to be confirmed by the user when the Client is created; it does not block code completion.

2. **Does `google-auth-library`'s `OAuth2Client` reduce risk enough to justify the stylistic inconsistency with Meta's raw-`fetch` pattern?**
   - What we know: Both approaches are functionally equivalent for this phase's 2-call flow; `OAuth2Client` is already an installed dependency.
   - What's unclear: Whether the planner/user prefers absolute consistency with the existing Meta route's style over marginally less boilerplate.
   - Recommendation: Default to raw `fetch` (this research's primary recommendation) unless the planner has a specific reason to prefer `OAuth2Client` — flagged as Claude's Discretion in CONTEXT.md, so either choice is valid; document whichever is chosen in the plan for future consistency.
   - **RESOLVED:** Both plans use raw `fetch`/`URLSearchParams` — Plan 02 builds the authorization URL with `URLSearchParams`, and Plan 03 exchanges the code via `fetch('https://oauth2.googleapis.com/token', ...)` — matching the Meta route's style per this research's primary recommendation. `google-auth-library`'s `OAuth2Client` is intentionally NOT used, prioritizing consistency with the existing Meta pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Google Cloud OAuth Client (`GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`) | Entire OAuth flow (both routes) | ✗ (confirmed via grep, D-03) | — | None — code must be written and be correct, but cannot be tested end-to-end live until the user creates the Client. This is the same class of blocker as the Phase 2 Developer Token; register as Deferred/Blocker, not a task. |
| `GOOGLE_OAUTH_STATE_SECRET` (new env var) | Signing/verifying `state` | ✗ (does not exist yet, D-07) | — | Must be generated (e.g. `openssl rand -hex 32`) and added to `.env.local` + Vercel (Production/Preview/Development) as part of this phase's task list — this one has NO external dependency, it's just a new random secret the plan can generate and document, unlike the OAuth Client which requires a real Google Cloud Console action. |
| `google-auth-library` | Optional alternative to raw `fetch` (see Alternatives Considered) | ✓ | `10.9.0` (verified current via `npm view`) | Not needed if raw `fetch` is used (recommended) |
| Node `crypto` (built-in) | `state` signing | ✓ | Built into Node 20/22 (Vercel's runtime) | None needed |

**Missing dependencies with no fallback:**
- Google Cloud OAuth Client — blocks live end-to-end testing only, not code completion. Track as an explicit Deferred/Blocker item per D-03, exactly like the Developer Token.

**Missing dependencies with fallback:**
- None applicable beyond the above — `GOOGLE_OAUTH_STATE_SECRET` is trivially generatable by the plan itself, not an external blocker.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` |
| Config file | `vitest.config.mts` (environment: node, setupFiles: `tests/setup.ts`, include: `tests/**/*.test.ts`) |
| Quick run command | `npx vitest run tests/unit/google-ads-connect-route.test.ts tests/unit/google-ads-callback-route.test.ts tests/unit/oauth-state.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SET-01 | `signState`/`verifyState` round-trip; rejects tampered signature; rejects expired payload | unit | `npx vitest run tests/unit/oauth-state.test.ts` | ❌ Wave 0 |
| SET-01 | `GET /api/google-ads/connect` rejects unauthenticated/wrong-role callers; resolves tenantId from claims for `tenant_admin`; builds a redirect URL containing `access_type=offline`+`prompt=consent`+signed `state` | unit (mock-based, mirrors `tests/unit/leads-status-route.test.ts`'s `vi.mock('@/lib/supabase/server', ...)` pattern) | `npx vitest run tests/unit/google-ads-connect-route.test.ts` | ❌ Wave 0 |
| SET-01 | `GET /api/google-ads/callback` rejects invalid/expired `state`; on valid `state` + successful token exchange, writes Vault secret + upserts `ad_accounts` with `active:true`; redirects to settings with `google_error=...` on Google error param or failed exchange | unit (mock `fetch`, mock `@/lib/supabase/service`) | `npx vitest run tests/unit/google-ads-callback-route.test.ts` | ❌ Wave 0 |
| SET-01 | Live manual verification: full browser round-trip once the Google Cloud OAuth Client exists (blocked by D-03/A1 above) | manual-only | — (requires real OAuth Client credentials, cannot be automated in CI without them) | N/A — document in a HUMAN-UAT.md once code-complete |

### Sampling Rate

- **Per task commit:** the relevant single test file(s) above (quick run command)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; live manual round-trip explicitly tracked as blocked-pending-infra (same precedent as Phase 4's N8N import and Phase 2's Developer Token — code-complete, verification deferred)

### Wave 0 Gaps

- [ ] `tests/unit/oauth-state.test.ts` — covers SET-01's `state` sign/verify correctness (no prior test for this since it's new code, unlike Vault RPC which already has `tests/integration/vault-rpc.test.ts`)
- [ ] `tests/unit/google-ads-connect-route.test.ts` — covers SET-01's auth/role/tenant-scope gate for `/connect`. **Note:** no equivalent test exists today for `app/api/meta-ads/connect/route.ts` either — this phase would be the first to establish this pattern's test coverage for an ad-connection route; consider whether backfilling Meta's route test is in scope (likely not — flag as out of scope unless the user requests it).
- [ ] `tests/unit/google-ads-callback-route.test.ts` — covers SET-01's token exchange, Vault write, `ad_accounts` upsert, and error-redirect paths
- Framework install: none — Vitest already configured project-wide, no new setup needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Yes | Google's OAuth2 authorization-code grant (delegated auth to a third party — no password ever touches this app) |
| V3 Session Management | Yes | Signed, expiring `state` param (Pattern 3) — the closest analogue to a session token this flow has, since D-01 forbids server-side session storage |
| V4 Access Control | Yes | Same `get_user_role()` RPC + `getClaims()`-derived tenant scope pattern already proven in `app/api/meta-ads/connect/route.ts` and required again in `/api/google-ads/connect` |
| V5 Input Validation | Yes | Zod validation of the Customer ID format (both client and server), and of the `state`/`code` query params before use |
| V6 Cryptography | Yes | `refresh_token` stored exclusively via the existing `create_or_update_vault_secret` RPC (Supabase Vault, AES-256 via pgsodium) — never hand-rolled encryption; `state` signing uses Node's built-in, unmodified `crypto.createHmac`/`timingSafeEqual` — never a custom HMAC implementation |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| CSRF via a forged/replayed `state` param, or an attacker completing an OAuth flow to bind their own Google account to a victim tenant | Spoofing / Tampering | HMAC-signed, server-verified `state` with expiry (Pattern 3); never trust an unsigned or unverified `state` |
| Authorization code interception / replay | Tampering | Google's authorization codes are single-use and short-lived server-side (Google enforces this); this app's only obligation is to not log the `code` and to exchange it immediately server-side over HTTPS |
| Credential leakage via logging | Information Disclosure | Never log `code`, `access_token`, or `refresh_token` — log only generic error strings (Pitfall 5), same convention as the Meta route |
| Privilege escalation via a `tenant_admin` supplying an arbitrary `tenantId` | Elevation of Privilege | `tenantId` for `tenant_admin` MUST be derived server-side from `getClaims()`, never from a client-controlled query param or the `state` payload's origin request body — identical to the Meta route's existing mitigation |
| Stale/partial credential from a missing `refresh_token` in the token response | Tampering (data integrity) | Treat a response without `refresh_token` as a hard failure, never a silent partial connect (Pitfall 2) |

## Sources

### Primary (HIGH confidence)
- [developers.google.com/identity/protocols/oauth2/web-server](https://developers.google.com/identity/protocols/oauth2/web-server) — authorization endpoint, all query params, token endpoint, response fields, redirect_uri exact-match requirement (fetched and verified this session via WebFetch)
- [nodejs.org/api/crypto.html](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options) — `createHmac`/`timingSafeEqual` exact usage (fetched and verified this session via WebFetch)
- `app/api/meta-ads/connect/route.ts`, `components/settings/meta-ads-form.tsx`, `app/[tenant-slug]/settings/page.tsx`, `supabase/migrations/0006_create_ad_accounts.sql`, `supabase/migrations/0013_create_vault_write_function.sql`, `proxy.ts`, `vitest.config.mts`, `package.json` — all read directly this session

### Secondary (MEDIUM confidence)
- WebSearch cross-referencing `prompt=consent` + `access_type=offline` behavior for guaranteeing a fresh `refresh_token` on every reconnect — confirmed via developers.google.com's own web-server doc plus two independent community sources (Medium/Auth0 community) in agreement
- Google Ads Customer ID 10-digit / `XXX-XXX-XXXX` format — confirmed via Google's own Support page (support.google.com/google-ads/answer/1704344) plus multiple third-party agency-help sources in agreement
- `google-auth-library`'s `OAuth2Client.generateAuthUrl()`/`.getToken()` capability — confirmed via npm/GitHub docs, cross-referenced with the installed version (`npm view` confirms `10.9.0` is current)

### Tertiary (LOW confidence)
- Which of the two Vercel domains found in STATE.md is the actual stable production domain (Open Question #1) — not verified this session, flagged for user confirmation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all primitives (Node crypto, fetch) verified against current official docs this session
- Architecture: HIGH — directly mirrors an existing, working, reviewed pattern (`app/api/meta-ads/connect/route.ts`) already proven in this codebase
- Pitfalls: HIGH for OAuth-specific pitfalls (verified against official docs); MEDIUM for the `proxy.ts` middleware interaction pitfall (logically sound based on `SameSite=Lax` defaults, but not live-tested in this exact codebase for this exact request shape)

**Research date:** 2026-07-11
**Valid until:** OAuth2 endpoints/params are stable, low churn — 90 days. The `proxy.ts` middleware interaction and exact production domain should be re-verified at plan/execution time regardless of this window, since they depend on this specific codebase's current state, not on Google's API stability.
