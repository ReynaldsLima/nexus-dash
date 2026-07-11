import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const OPTS = { max: 20, windowMs: 5 * 60 * 1000 }

describe('checkRateLimit (lib/rate-limit)', () => {
  beforeEach(() => {
    vi.resetModules() // fresh module-level Map per test
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows up to max calls within the window', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    for (let i = 0; i < OPTS.max; i++) {
      expect(checkRateLimit('user-A', OPTS).allowed).toBe(true)
    }
  })

  it('rejects the max+1th call within the window with retryAfterSeconds > 0', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    for (let i = 0; i < OPTS.max; i++) checkRateLimit('user-B', OPTS)
    const res = checkRateLimit('user-B', OPTS)
    expect(res.allowed).toBe(false)
    expect(res.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('allows again after the window elapses', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { checkRateLimit } = await import('@/lib/rate-limit')
    for (let i = 0; i < OPTS.max; i++) checkRateLimit('user-C', OPTS)
    expect(checkRateLimit('user-C', OPTS).allowed).toBe(false)
    // advance just past the 5-minute window
    vi.setSystemTime(new Date('2026-01-01T00:05:01Z'))
    expect(checkRateLimit('user-C', OPTS).allowed).toBe(true)
  })

  it('isolates counts by key (different user_ids do not interfere)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    for (let i = 0; i < OPTS.max; i++) checkRateLimit('user-D', OPTS)
    expect(checkRateLimit('user-D', OPTS).allowed).toBe(false)
    expect(checkRateLimit('user-E', OPTS).allowed).toBe(true)
  })
})
