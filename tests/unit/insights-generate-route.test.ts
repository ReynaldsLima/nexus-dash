import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * AI-01 — POST /api/insights/generate streams an on-demand analysis. It is super_admin-ONLY
 * (AI-03 wording "accessible only to Super Admin"). Auth/role gate mirrors
 * app/api/meta-ads/connect/route.ts: getUser() → 401 if no user, get_user_role() RPC → 403 if
 * role !== 'super_admin'.
 *
 * Filled in by Plan 03 (app/api/insights/generate/route.ts).
 */

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))

const mockState = {
  user: null as { id: string } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
  tenantId: 'tenant-1' as string | null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
    rpc: () => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/ai/insight-prompt', () => ({
  resolveTenantId: (slug: string) => Promise.resolve(slug === 'unknown-tenant' ? null : mockState.tenantId),
  buildOnDemandPrompt: () => Promise.resolve({ system: 'system prompt', user: 'user prompt' }),
}))

vi.mock('ai', () => ({
  streamText: () => ({
    toTextStreamResponse: () => new Response('ok'),
  }),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/insights/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.tenantId = 'tenant-1'
  vi.resetModules()
})

describe('POST /api/insights/generate — auth/role gate (AI-01)', () => {
  it('no authenticated user → 401', async () => {
    mockState.user = null
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({ tenantSlug: 'acme' }))
    expect(res.status).toBe(401)
  })

  it("role 'tenant_admin' → 403 (super_admin only)", async () => {
    mockState.role = 'tenant_admin'
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({ tenantSlug: 'acme' }))
    expect(res.status).toBe(403)
  })

  it("role 'viewer' → 403", async () => {
    mockState.role = 'viewer'
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({ tenantSlug: 'acme' }))
    expect(res.status).toBe(403)
  })

  it("role 'agency' → 403", async () => {
    mockState.role = 'agency'
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({ tenantSlug: 'acme' }))
    expect(res.status).toBe(403)
  })

  it('get_user_role RPC error / null role → 403', async () => {
    mockState.role = null
    mockState.roleError = { message: 'rpc failed' }
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({ tenantSlug: 'acme' }))
    expect(res.status).toBe(403)
  })

  it('missing or unknown tenantSlug in body → 400', async () => {
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('super_admin + valid tenantSlug → streams response (200)', async () => {
    const { POST } = await import('@/app/api/insights/generate/route')
    const res = await POST(makeRequest({ tenantSlug: 'acme' }))
    expect(res.status).toBe(200)
  })
})

describe('insights-generate-route scaffold sanity', () => {
  it('vitest is wired', () => {
    expect(true).toBe(true)
  })
})
