// lib/rate-limit.ts
// Sliding-window in-memory rate limiter (D-02/D-03). Per-instance only: the Map lives in one serverless
// function instance's memory and is wiped on cold start / not shared across concurrent instances. Accepted
// as sufficient for 1-3 tenants with known authenticated users — the goal is preventing casual/accidental
// runaway usage of the shared Anthropic key, not a hard cryptographic cap. See 06-RESEARCH.md Pattern 4.
const buckets = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const windowStart = now - opts.windowMs
  const existing = (buckets.get(key) ?? []).filter((ts) => ts > windowStart)

  if (existing.length >= opts.max) {
    const retryAfterSeconds = Math.ceil((existing[0] + opts.windowMs - now) / 1000)
    buckets.set(key, existing) // manter array podado, não crescer em tentativa rejeitada
    return { allowed: false, retryAfterSeconds }
  }

  existing.push(now)
  buckets.set(key, existing)
  return { allowed: true, retryAfterSeconds: 0 }
}
