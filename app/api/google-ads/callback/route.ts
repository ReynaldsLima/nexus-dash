import { NextRequest, NextResponse } from 'next/server'
import { verifyState } from '@/lib/google-ads/oauth-state'
import { createServiceClient } from '@/lib/supabase/service'

// Node runtime required: service role client uses 'server-only', and Vault writes
// must not be bundled or executed in the Edge runtime.
export const runtime = 'nodejs'

// ─── GET /api/google-ads/callback ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // ── 1. Verify state FIRST — it carries the authoritative tenant binding ───
  // (CSRF/replay defense, T-07-01). Distinguish a BAD/tampered signature
  // (untrustworthy → root fallback) from a validly-signed-but-EXPIRED state
  // (trustworthy tenantSlug → back to Settings, D-04).
  const rawState = req.nextUrl.searchParams.get('state') ?? ''
  const verified = verifyState(rawState)
  if (!verified) {
    // Bad signature / malformed / unparseable → we cannot trust any tenant identity,
    // so we cannot build a tenant-scoped redirect. Send to root. Never write anything.
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  const { payload, expired } = verified
  const { tenantId, tenantSlug, customerId } = payload

  // Helper to build the settings redirect used by every subsequent exit.
  function settingsRedirect(errCode?: string) {
    const url = new URL(`/${tenantSlug}/settings`, req.nextUrl.origin)
    if (errCode) url.searchParams.set('google_error', errCode)
    else url.searchParams.set('google_connected', '1')
    return NextResponse.redirect(url)
  }

  // ── 2. Expired-but-validly-signed state (D-04) ────────────────────────────
  // Because the HMAC verified, tenantSlug is authentic. STATE_TTL_MS is only
  // 10 minutes, so a user who spent longer than that on Google's consent /
  // 2FA / account-picker screen hits this branch in NORMAL use — bounce them
  // back to THEIR own Settings with an inline error instead of the anonymous
  // root fallback. No writes.
  if (expired) return settingsRedirect('state_expired')

  // ── 3. Google returned an error param (consent denied etc.) (D-04) ────────
  const googleError = req.nextUrl.searchParams.get('error')
  if (googleError) return settingsRedirect(googleError)

  // ── 4. Require code ────────────────────────────────────────────────────────
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return settingsRedirect('missing_code')

  // ── 5. Exchange the code (raw fetch; redirect_uri MUST equal the connect
  // route's — same req.nextUrl.origin source, Pitfall 1) ────────────────────
  const redirectUri = `${req.nextUrl.origin}/api/google-ads/callback`
  let tokenRes: Response
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
  } catch {
    return settingsRedirect('token_exchange_failed')
  }
  if (!tokenRes.ok) return settingsRedirect('token_exchange_failed') // never log the body (Pitfall 5)
  const tokens = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  // ── 6. Missing refresh_token is a HARD error (Pitfall 2 / T-07-05 — never
  // silently persist) ────────────────────────────────────────────────────────
  if (!tokens.refresh_token) return settingsRedirect('no_refresh_token')

  // ── 7. Write refresh_token to Vault + upsert ad_accounts (service role —
  // mirror Meta) ──────────────────────────────────────────────────────────────
  const service = createServiceClient()
  const secretName = `google_ads_token_${tenantId}`
  const { data: secretId, error: vaultErr } = await service.rpc(
    'create_or_update_vault_secret',
    { p_name: secretName, p_secret: tokens.refresh_token }
  )
  if (vaultErr || !secretId) {
    console.error('[google-ads/callback] Vault write failed:', vaultErr?.message)
    return settingsRedirect('vault_write_failed')
  }
  const { error: upsertErr } = await service.from('ad_accounts').upsert(
    {
      tenant_id: tenantId,
      channel: 'google_ads',
      account_id: customerId,
      vault_secret_id: secretId as string,
      active: true,
    },
    { onConflict: 'tenant_id,channel' }
  )
  if (upsertErr) {
    console.error('[google-ads/callback] ad_accounts upsert failed:', upsertErr.message)
    return settingsRedirect('save_failed')
  }

  // ── 8. Success ──────────────────────────────────────────────────────────────
  return settingsRedirect()
}
