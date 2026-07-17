import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// 10 minutes — matches Google's own OAuth `state` round-trip window comfortably
// while limiting the blast radius of a leaked/replayed state value (T-07-01).
const STATE_TTL_MS = 10 * 60 * 1000

export interface StatePayload {
  tenantId: string
  tenantSlug: string
  customerId: string
  backfillDays: number
  nonce: string
  iat: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

// Mirrors the DB CHECK constraint on tenants.slug (migration 0002_create_tenants.sql:
// `slug ~ '^[a-z0-9-]+$' AND char_length(slug) BETWEEN 2 AND 50`). Any tenantSlug value
// coming from a query string or a signed state MUST pass this check before it's ever
// embedded in a redirect Location header — otherwise a value like `/evil.com` (which
// contains no dot/slash-breaking chars once restricted to this charset) could turn
// `new URL('/' + slug + '/settings', origin)` into a protocol-relative open redirect
// (CWE-601, CR-01).
const TENANT_SLUG_RE = /^[a-z0-9-]{2,50}$/

export function safeTenantSlug(raw: string | null | undefined): string | null {
  return raw && TENANT_SLUG_RE.test(raw) ? raw : null
}

function secret(): string {
  const s = process.env.GOOGLE_OAUTH_STATE_SECRET
  if (!s) throw new Error('GOOGLE_OAUTH_STATE_SECRET is not set')
  return s
}

// signState — builds a `${payloadB64}.${signatureB64url}` state string. Uses
// node:crypto's HMAC-SHA256 (no JWT library) per RESEARCH's "Don't Hand-Roll"
// guidance: the HMAC is the correct, minimal primitive for a same-origin
// round-trip value, not a general-purpose token format.
export function signState(
  tenantId: string,
  tenantSlug: string,
  customerId: string,
  backfillDays: number
): string {
  const payload: StatePayload = {
    tenantId,
    tenantSlug,
    customerId,
    backfillDays,
    nonce: randomBytes(16).toString('hex'),
    iat: Date.now(),
  }
  const payloadB64 = base64url(JSON.stringify(payload))
  const signature = createHmac('sha256', secret()).update(payloadB64).digest('base64url')
  return `${payloadB64}.${signature}`
}

// verifyState — returns a DISCRIMINATED result so the callback (Plan 03) can
// tell a bad/tampered signature (→ redirect to '/') apart from a
// validly-signed-but-expired state (→ redirect to the recovered tenant's
// Settings page with google_error=state_expired, D-04).
export function verifyState(state: string): { payload: StatePayload; expired: boolean } | null {
  const [payloadB64, signature] = state.split('.')
  if (!payloadB64 || !signature) return null

  const expected = createHmac('sha256', secret()).update(payloadB64).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  // Bad signature / malformed → payload untrustworthy → null (callback falls back to '/').
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as StatePayload
    if (typeof payload.iat !== 'number') return null
    // Signature is VALID here → tenantSlug is trustworthy even if stale. Surface
    // expiry as a flag, NOT as null, so the callback can redirect to
    // /${tenantSlug}/settings?google_error=state_expired (D-04).
    const expired = Date.now() - payload.iat > STATE_TTL_MS
    return { payload, expired }
  } catch {
    return null
  }
}
