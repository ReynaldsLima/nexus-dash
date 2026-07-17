import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))

const mockState = {
  user: { id: 'user-1' } as { id: string } | null,
  role: 'super_admin' as string | null,
  roleError: null as { message: string } | null,
  vaultSecretId: null as string | null,
  vaultError: null as { message: string } | null,
  vaultRpcCalls: [] as Array<{ name: string; args: unknown }>,
  upsertCalls: [] as Array<{ payload: unknown; opts: unknown }>,
  upsertError: null as { message: string } | null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
    rpc: (_name: string) => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: (name: string, args: unknown) => {
      mockState.vaultRpcCalls.push({ name, args })
      return Promise.resolve({ data: mockState.vaultSecretId, error: mockState.vaultError })
    },
    from: (_table: string) => ({
      upsert: (payload: unknown, opts: unknown) => {
        mockState.upsertCalls.push({ payload, opts })
        return Promise.resolve({ error: mockState.upsertError })
      },
    }),
  }),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/meta-ads/connect', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function graphOkResponse() {
  return {
    ok: true,
    json: async () => ({ id: '1', name: 'x' }),
  }
}

const TENANT_ID = '00000000-0000-4000-8000-000000000001'

beforeEach(() => {
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.vaultSecretId = 'secret-uuid'
  mockState.vaultError = null
  mockState.vaultRpcCalls = []
  mockState.upsertCalls = []
  mockState.upsertError = null
  vi.stubGlobal('fetch', vi.fn(async () => graphOkResponse()))
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/meta-ads/connect', () => {
  it('backfillDays=45 + valid token → upsert payload includes backfill_days: 45', async () => {
    const { POST } = await import('@/app/api/meta-ads/connect/route')
    const res = await POST(
      makeRequest({
        accountId: '123456789',
        token: 'a'.repeat(20),
        tenantId: TENANT_ID,
        backfillDays: 45,
      })
    )
    const data = (await res.json()) as { success?: boolean }
    expect(data.success).toBe(true)
    expect(mockState.upsertCalls.length).toBe(1)
    expect(mockState.upsertCalls[0].payload).toMatchObject({
      backfill_days: 45,
      channel: 'meta_ads',
    })
  })

  it('omitting backfillDays → upsert payload includes backfill_days: 90 (default)', async () => {
    const { POST } = await import('@/app/api/meta-ads/connect/route')
    const res = await POST(
      makeRequest({
        accountId: '123456789',
        token: 'a'.repeat(20),
        tenantId: TENANT_ID,
      })
    )
    const data = (await res.json()) as { success?: boolean }
    expect(data.success).toBe(true)
    expect(mockState.upsertCalls.length).toBe(1)
    expect(mockState.upsertCalls[0].payload).toMatchObject({
      backfill_days: 90,
    })
  })

  it('backfillDays=3 (below min) → 400, no upsert', async () => {
    const { POST } = await import('@/app/api/meta-ads/connect/route')
    const res = await POST(
      makeRequest({
        accountId: '123456789',
        token: 'a'.repeat(20),
        tenantId: TENANT_ID,
        backfillDays: 3,
      })
    )
    expect(res.status).toBe(400)
    expect(mockState.upsertCalls.length).toBe(0)
  })
})
