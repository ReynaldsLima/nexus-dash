import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { signState, safeTenantSlug } from '@/lib/google-ads/oauth-state'

// Node runtime required: getClaims() needs Node's RS256/crypto, matching the
// meta-ads/connect route's convention.
export const runtime = 'nodejs'

// ─── Customer ID schema ────────────────────────────────────────────────────
// Accepts Google Ads' canonical dashed format (123-456-7890) or raw digits;
// normalizes to digits-only before it's ever embedded in the signed state
// or sent onward (Pitfall 4).
const CustomerIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => /^\d{3}-?\d{3}-?\d{4}$/.test(v), 'Customer ID inválido')
  .transform((v) => v.replace(/-/g, ''))

// ─── Backfill window schema (SET-03/T-11-03) ───────────────────────────────
// `.coerce` because the query param arrives as a string; `.catch(90)` makes
// any missing/malformed/out-of-range value fall back to the default 90 rather
// than blocking the whole connect flow — the DB CHECK + the callback
// re-validation are the hard gate.
const BackfillDaysSchema = z.coerce.number().int().min(7).max(365).catch(90)

// ─── GET /api/google-ads/connect ───────────────────────────────────────────
// Entered via a top-level browser navigation (window.location.href, Plan 04).
// Every non-success path (after the no-user case) therefore REDIRECTS back to
// /${tenantSlug}/settings?google_error=<code> (D-04) instead of returning raw
// JSON, which would render unstyled with no way back to Settings.
export async function GET(req: NextRequest) {
  // ── 1. Auth: verify session ───────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // The ONE JSON error kept: at this point no tenant context exists to build
    // a settings redirect. In practice proxy.ts already redirects unauthenticated
    // users to /login before this handler runs — documented limitation.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Error-redirect helper ───────────────────────────────────────────────
  // Built from the query `tenantSlug` (the Settings page the user came from).
  // Used ONLY to surface errors inline on that page (D-04) — NEVER for
  // authorization (T-07-02: tenant_admin's authoritative tenant still comes
  // from getClaims() in step 5).
  // Validated with safeTenantSlug (CR-01): an unvalidated tenantSlug (e.g. `/evil.com`)
  // would let `new URL('/' + slug + '/settings', origin)` resolve as a protocol-relative
  // open redirect (CWE-601). Only a value matching the tenants.slug charset is used.
  const redirectSlug = safeTenantSlug(req.nextUrl.searchParams.get('tenantSlug'))
  function errorRedirect(code: string) {
    if (!redirectSlug) return NextResponse.json({ error: code }, { status: 400 }) // no slug → cannot redirect; JSON fallback
    const url = new URL(`/${redirectSlug}/settings`, req.nextUrl.origin)
    url.searchParams.set('google_error', code)
    return NextResponse.redirect(url)
  }

  // ── 3. Role check ───────────────────────────────────────────────────────────
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')

  if (roleErr || !role || (role !== 'super_admin' && role !== 'tenant_admin')) {
    return errorRedirect('forbidden')
  }

  // ── 4. Validate customerId ──────────────────────────────────────────────────
  const customerIdRaw = req.nextUrl.searchParams.get('customerId') ?? ''
  const parsed = CustomerIdSchema.safeParse(customerIdRaw)
  if (!parsed.success) return errorRedirect('invalid_customer_id')
  const customerId = parsed.data // digits-only (Pitfall 4)

  // Non-authorization value — never influences tenant scoping (step 5 below).
  const backfillDays = BackfillDaysSchema.parse(req.nextUrl.searchParams.get('backfillDays'))

  // ── 5. Resolve AUTHORITATIVE tenant scope for the signed state ─────────────
  // Elevation-of-Privilege mitigation T-07-02: for tenant_admin, tenantId/tenantSlug
  // come from getClaims() (verified JWT claims) — never from the query string.
  let tenantId: string
  let tenantSlug: string
  if (role === 'super_admin') {
    // WR-03: validate format (UUID / slug charset) rather than a bare truthiness
    // check — a malformed tenantId would otherwise only fail much later, at the
    // callback's ad_accounts upsert FK constraint, surfacing an opaque save_failed.
    const parsedTenantId = z.uuid().safeParse(req.nextUrl.searchParams.get('tenantId'))
    const parsedTenantSlug = safeTenantSlug(req.nextUrl.searchParams.get('tenantSlug'))
    if (!parsedTenantId.success || !parsedTenantSlug) return errorRedirect('missing_tenant')
    tenantId = parsedTenantId.data
    tenantSlug = parsedTenantSlug
  } else {
    const { data: claimsData } = await supabase.auth.getClaims()
    const claimTenantId = claimsData?.claims?.app_metadata?.tenant_id as string | undefined
    const claimTenantSlug = claimsData?.claims?.app_metadata?.tenant_slug as string | undefined
    if (!claimTenantId || !claimTenantSlug) return errorRedirect('forbidden')
    tenantId = claimTenantId
    tenantSlug = claimTenantSlug // query values are IGNORED for tenant_admin authorization
  }

  // ── 6. Build signed state + redirect to Google ─────────────────────────────
  // redirect_uri computed from a SINGLE source of truth (req.nextUrl.origin) so
  // it matches the callback's byte-for-byte (Pitfall 1).
  const signedState = signState(tenantId, tenantSlug, customerId, backfillDays)
  const redirectUri = `${req.nextUrl.origin}/api/google-ads/callback`
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords',
    access_type: 'offline',
    prompt: 'consent',
    state: signedState,
  })

  // Never log customerId, tenant identifiers, or the state value (Pitfall 5).
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
