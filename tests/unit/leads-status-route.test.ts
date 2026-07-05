import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))

const mockState = {
  user: null as { id: string } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
  tenant: null as { sheet_id: string; sheets_service_account: unknown } | null,
  tenantError: null as { message: string } | null,
  updateLeadStatusImpl: async () => {},
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
