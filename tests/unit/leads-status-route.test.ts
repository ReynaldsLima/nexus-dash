import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))
// revalidateTag exige um request-scoped cache context indisponível fora do runtime do Next.js.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

const mockState = {
  user: null as { id: string; app_metadata?: Record<string, unknown> } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
  tenant: null as { sheet_id: string; sheets_service_account: unknown } | null,
  tenantError: null as { message: string } | null,
  grant: null as { tenant_id: string } | null,
  updateLeadStatusImpl: async (..._args: unknown[]) => {},
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
    rpc: () => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: mockState.grant, error: null }),
          }),
        }),
      }),
    }),
  }),
}))

// sheets_service_account só é legível via service_role (migration 0016) — a rota usa
// createServiceClient() para essa leitura, não o cliente vinculado ao usuário acima.
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockState.tenant, error: mockState.tenantError }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/sheets', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/sheets')>()
  return {
    ...actual,
    updateLeadStatus: (...args: Parameters<typeof actual.updateLeadStatus>) =>
      mockState.updateLeadStatusImpl(...args),
  }
})

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/leads/0/status', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.tenant = { sheet_id: 'sheet-123', sheets_service_account: { client_email: 'a@b.com', private_key: 'k' } }
  mockState.tenantError = null
  mockState.grant = null
  mockState.updateLeadStatusImpl = async () => {}
  vi.resetModules()
})

describe('PATCH /api/leads/[id]/status', () => {
  it('id inválido (não inteiro) → 400', async () => {
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(res.status).toBe(400)
  })

  it('id inválido (negativo) → 400', async () => {
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('sem usuário autenticado → 401', async () => {
    mockState.user = null
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(401)
  })

  it("role 'viewer' → 403", async () => {
    mockState.role = 'viewer'
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(403)
  })

  it('role null / erro no RPC → 403', async () => {
    mockState.role = null
    mockState.roleError = { message: 'rpc failed' }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(403)
  })

  it('tenant não encontrado → 404', async () => {
    mockState.tenant = null
    mockState.tenantError = { message: 'not found' }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(404)
  })

  it('tenant sem sheets_service_account → 404', async () => {
    mockState.tenant = { sheet_id: 'sheet-123', sheets_service_account: null }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(404)
  })

  it("role 'super_admin' + updateLeadStatus resolve → 200 { success: true }", async () => {
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
  })

  it('updateLeadStatus lança erro shape 429 → resposta 429 com mensagem de rate limit', async () => {
    mockState.updateLeadStatusImpl = async () => {
      throw { response: { status: 429 } }
    }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toContain('Limite de escrita')
  })

  it('updateLeadStatus lança erro shape 403 → resposta 403 com mensagem de permissão', async () => {
    mockState.updateLeadStatusImpl = async () => {
      throw { response: { status: 403 } }
    }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), {
      params: Promise.resolve({ id: '0' }),
    })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('permissão')
  })
})

describe('PATCH /api/leads/[id]/status — tenant/agency scope enforcement (AGENCY-08)', () => {
  it("role 'tenant_admin' whose own tenant_slug differs from body.tenant → 403 (cross-tenant IDOR)", async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'user-1', app_metadata: { tenant_slug: 'outra-empresa' } }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), { params: Promise.resolve({ id: '0' }) })
    expect(res.status).toBe(403)
  })

  it("role 'tenant_admin' whose own tenant_slug matches body.tenant → 200 (unchanged happy path)", async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'user-1', app_metadata: { tenant_slug: 'acme' } }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), { params: Promise.resolve({ id: '0' }) })
    expect(res.status).toBe(200)
  })

  it("role 'agency' with no grant for body.tenant in agency_tenants → 403", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: { agency_id: 'agency-1' } }
    mockState.grant = null
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), { params: Promise.resolve({ id: '0' }) })
    expect(res.status).toBe(403)
  })

  it("role 'agency' with a grant for body.tenant in agency_tenants → 200", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: { agency_id: 'agency-1' } }
    mockState.grant = { tenant_id: 'tenant-1' }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), { params: Promise.resolve({ id: '0' }) })
    expect(res.status).toBe(200)
  })

  it("role 'agency' with no agency_id in app_metadata → 403 (malformed claim, fail closed)", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: {} }
    const { PATCH } = await import('@/app/api/leads/[id]/status/route')
    const res = await PATCH(makeRequest({ tenant: 'acme', status: 'Quente' }), { params: Promise.resolve({ id: '0' }) })
    expect(res.status).toBe(403)
  })
})
