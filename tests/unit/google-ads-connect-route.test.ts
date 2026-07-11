import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))

const mockState = {
  user: null as { id: string; app_metadata?: Record<string, unknown> } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
      // Route reads tenant_id/tenant_slug from getClaims() (verified JWT claims), not from
      // getUser()'s user.app_metadata — see
      // .planning/debug/resolved/agency-app-metadata-getuser-mismatch.md.
      getClaims: () =>
        Promise.resolve({ data: { claims: { app_metadata: mockState.user?.app_metadata ?? {} } } }),
    },
    rpc: () => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
  }),
}))

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/google-ads/connect?${query}`, { method: 'GET' })
}

beforeEach(() => {
  process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-secret-32-bytes-minimum-abcdef'
  process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  vi.resetModules()
})

describe('GET /api/google-ads/connect', () => {
  it('no authenticated user → 401 (JSON, documented limitation)', async () => {
    mockState.user = null
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('customerId=123-456-7890&tenantId=tenant-uuid-1&tenantSlug=acme'))
    expect(res.status).toBe(401)
  })

  it('get_user_role RPC error or null role → redirect to /acme/settings?google_error=forbidden', async () => {
    mockState.role = null
    mockState.roleError = { message: 'rpc failed' }
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('customerId=123-456-7890&tenantId=tenant-uuid-1&tenantSlug=acme'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(loc).toContain('/acme/settings')
    expect(loc).toContain('google_error=forbidden')
  })

  it("role 'viewer' → redirect ?google_error=forbidden", async () => {
    mockState.role = 'viewer'
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('customerId=123-456-7890&tenantId=tenant-uuid-1&tenantSlug=acme'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(loc).toContain('/acme/settings')
    expect(loc).toContain('google_error=forbidden')
  })

  it('missing customerId query param → redirect ?google_error=invalid_customer_id', async () => {
    mockState.role = 'super_admin'
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('tenantId=tenant-uuid-1&tenantSlug=acme'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=invalid_customer_id')
  })

  it('invalid customerId format (letters) → redirect ?google_error=invalid_customer_id', async () => {
    mockState.role = 'super_admin'
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('customerId=abc&tenantId=tenant-uuid-1&tenantSlug=acme'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=invalid_customer_id')
  })

  it('super_admin + valid customerId → 307 redirect to Google with required params', async () => {
    mockState.role = 'super_admin'
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(
      makeRequest('customerId=123-456-7890&tenantId=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee&tenantSlug=acme')
    )
    expect(res.status).toBe(307)
    const loc = res.headers.get('location')!
    expect(loc).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(loc).toContain('access_type=offline')
    expect(loc).toContain('prompt=consent')
    expect(loc).toContain('scope=')
    expect(decodeURIComponent(loc)).toContain('adwords')
    expect(loc).toContain('state=')
    expect(loc).toContain('response_type=code')
  })

  it('super_admin + malformed tenantId (not a UUID) → redirect ?google_error=missing_tenant (WR-03)', async () => {
    mockState.role = 'super_admin'
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('customerId=123-456-7890&tenantId=not-a-uuid&tenantSlug=acme'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=missing_tenant')
    expect(loc).not.toContain('accounts.google.com')
  })

  it('tenant_admin resolves tenantId/tenantSlug from claims, NOT from query', async () => {
    mockState.role = 'tenant_admin'
    mockState.user = {
      id: 'u1',
      app_metadata: { tenant_id: 'claim-tenant', tenant_slug: 'claim-slug' },
    }
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(
      makeRequest('customerId=123-456-7890&tenantId=attacker-tenant&tenantSlug=attacker-slug')
    )
    expect(res.status).toBe(307)
    const loc = res.headers.get('location')!
    const url = new URL(loc)
    const state = url.searchParams.get('state')!
    const [payloadB64] = state.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    expect(payload.tenantId).toBe('claim-tenant')
    expect(payload.tenantSlug).toBe('claim-slug')
  })

  it('tenant_admin with no tenant_id claim → redirect ?google_error=forbidden (fail closed)', async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'u1', app_metadata: {} }
    const { GET } = await import('@/app/api/google-ads/connect/route')
    const res = await GET(makeRequest('customerId=123-456-7890&tenantSlug=acme'))
    expect([302, 307]).toContain(res.status)
    const loc = res.headers.get('location')!
    expect(loc).toContain('google_error=forbidden')
    expect(loc).not.toContain('accounts.google.com')
  })
})
