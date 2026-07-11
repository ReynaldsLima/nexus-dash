import { describe, it, expect } from 'vitest'

/**
 * AI-01 — POST /api/insights/generate streams an on-demand analysis. It is super_admin-ONLY
 * (AI-03 wording "accessible only to Super Admin"). Auth/role gate mirrors
 * app/api/meta-ads/connect/route.ts: getUser() → 401 if no user, get_user_role() RPC → 403 if
 * role !== 'super_admin'.
 *
 * Filled in by Plan 03 (app/api/insights/generate/route.ts).
 */
describe('POST /api/insights/generate — auth/role gate (AI-01)', () => {
  it.todo('no authenticated user → 401')
  it.todo("role 'tenant_admin' → 403 (super_admin only)")
  it.todo("role 'viewer' → 403")
  it.todo("role 'agency' → 403")
  it.todo('get_user_role RPC error / null role → 403')
  it.todo('missing or unknown tenantSlug in body → 400')
})

describe('insights-generate-route scaffold sanity', () => {
  it('vitest is wired', () => {
    expect(true).toBe(true)
  })
})
