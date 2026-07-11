import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

// GOOGLE_OAUTH_STATE_SECRET must be set BEFORE the module under test is imported —
// the helper reads it at call time via process.env, so this must run before any
// `await import('@/lib/google-ads/oauth-state')` below.
beforeAll(() => {
  process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-secret-32-bytes-minimum-abcdef'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lib/google-ads/oauth-state', () => {
  it('round-trip: signState then verifyState returns expired:false and the same tenantId/tenantSlug/customerId', async () => {
    const { signState, verifyState } = await import('@/lib/google-ads/oauth-state')
    const s = signState('tenant-uuid-1', 'acme', '1234567890')
    const r = verifyState(s)
    expect(r).not.toBeNull()
    expect(r!.expired).toBe(false)
    expect(r!.payload.tenantId).toBe('tenant-uuid-1')
    expect(r!.payload.tenantSlug).toBe('acme')
    expect(r!.payload.customerId).toBe('1234567890')
  })

  it('verifyState returns null for a tampered signature', async () => {
    const { signState, verifyState } = await import('@/lib/google-ads/oauth-state')
    const s = signState('tenant-uuid-1', 'acme', '1234567890')
    const [payloadB64, signature] = s.split('.')
    // Mutate the last char of the signature segment (after the dot).
    const lastChar = signature.slice(-1)
    const swapped = lastChar === 'A' ? 'B' : 'A'
    const tampered = `${payloadB64}.${signature.slice(0, -1)}${swapped}`
    expect(verifyState(tampered)).toBeNull()
  })

  it('verifyState returns null for a tampered payload', async () => {
    const { signState, verifyState } = await import('@/lib/google-ads/oauth-state')
    const s = signState('tenant-uuid-1', 'acme', '1234567890')
    const [payloadB64, signature] = s.split('.')
    // Mutate a char in the payload segment (before the dot).
    const lastChar = payloadB64.slice(-1)
    const swapped = lastChar === 'A' ? 'B' : 'A'
    const tampered = `${payloadB64.slice(0, -1)}${swapped}.${signature}`
    expect(verifyState(tampered)).toBeNull()
  })

  it('verifyState returns null for malformed input (no dot / empty)', async () => {
    const { verifyState } = await import('@/lib/google-ads/oauth-state')
    expect(verifyState('garbage')).toBeNull()
    expect(verifyState('')).toBeNull()
  })

  it('verifyState returns { expired: true } (NOT null) for an expired-but-validly-signed payload, preserving the payload', async () => {
    vi.useFakeTimers()
    const { signState, verifyState } = await import('@/lib/google-ads/oauth-state')
    const s = signState('tenant-uuid-1', 'acme', '1234567890')
    // Advance system time past the 10 minute TTL (D-04 recovery case).
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    const r = verifyState(s)
    expect(r).not.toBeNull()
    expect(r!.expired).toBe(true)
    expect(r!.payload.tenantSlug).toBe('acme')
    expect(r!.payload.tenantId).toBe('tenant-uuid-1')
  })

  it('signState produces two segments separated by a single dot, both non-empty base64url', async () => {
    const { signState } = await import('@/lib/google-ads/oauth-state')
    const s = signState('tenant-uuid-1', 'acme', '1234567890')
    const segments = s.split('.')
    expect(segments).toHaveLength(2)
    for (const segment of segments) {
      expect(segment.length).toBeGreaterThan(0)
      expect(segment).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })
})
