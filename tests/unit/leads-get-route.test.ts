import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const mockState = {
  user: null as { id: string; app_metadata?: Record<string, unknown> } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
  tenant: null as { sheet_id: string | null; sheets_api_key: string | null } | null,
  tenantError: null as { message: string } | null,
  grant: null as { tenant_id: string } | null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
      getClaims: () =>
        Promise.resolve({ data: { claims: { app_metadata: mockState.user?.app_metadata ?? {} } } }),
    },
    rpc: () => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockState.tenant, error: mockState.tenantError }),
            maybeSingle: () => Promise.resolve({ data: mockState.grant, error: null }),
          }),
        }),
      }),
    }),
  }),
}))

function makeRequest(tenant?: string) {
  const url = tenant
    ? `http://localhost/api/leads?tenant=${tenant}`
    : `http://localhost/api/leads`
  return new NextRequest(url, { method: 'GET' })
}

beforeEach(() => {
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.tenant = { sheet_id: 'sheet-123', sheets_api_key: null } // configured:false → 200 without fetch
  mockState.tenantError = null
  mockState.grant = null
  vi.resetModules()
})

describe('GET /api/leads — auth/role/scope gate (AGENCY-08)', () => {
  it('missing tenant param → 400', async () => {
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('no authenticated user → 401', async () => {
    mockState.user = null
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(401)
  })

  it("role 'invalid_role' → 403", async () => {
    mockState.role = 'invalid_role'
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(403)
  })

  it('role null / RPC error → 403', async () => {
    mockState.role = null
    mockState.roleError = { message: 'rpc failed' }
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(403)
  })

  it("role 'tenant_admin' with mismatched tenant_slug → 403", async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'user-1', app_metadata: { tenant_slug: 'outra-empresa' } }
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(403)
  })

  it("role 'tenant_admin' with matching tenant_slug → 200", async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'user-1', app_metadata: { tenant_slug: 'acme' } }
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(200)
  })

  it("role 'agency' with no grant → 403", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: { agency_id: 'agency-1' } }
    mockState.grant = null
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(403)
  })

  it("role 'agency' with a grant → 200", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: { agency_id: 'agency-1' } }
    mockState.grant = { tenant_id: 'tenant-1' }
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(200)
  })

  it("role 'agency' with no agency_id in claims → 403 (fail closed)", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: {} }
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(403)
  })

  it("role 'super_admin' → 200 unconditionally", async () => {
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/leads — ordem padrão (mais novo primeiro)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retorna os leads ordenados do mais novo para o mais antigo, preservando id', async () => {
    mockState.tenant = { sheet_id: 'sheet-123', sheets_api_key: 'key-abc' }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        values: [
          ['Ana', '11...', 'a@x.com', 'ACME', '31/07/2026', 'Novo Lead', '', 'Vida'],
          ['Bruno', '11...', 'b@x.com', 'Beta', '02/08/2026', 'Quente', '', 'Saúde'],
          ['Carla', '11...', 'c@x.com', 'Ceta', '15/06/2026', 'Novo Lead', '', 'Vida'],
        ],
      }),
    })))
    const { GET } = await import('@/app/api/leads/route')
    const res = await GET(makeRequest('acme'))
    const body = await res.json()
    expect(body.leads.map((l: { nome: string }) => l.nome)).toEqual(['Bruno', 'Ana', 'Carla'])
    expect(body.leads.map((l: { id: number }) => l.id)).toEqual([1, 0, 2])
  })
})
