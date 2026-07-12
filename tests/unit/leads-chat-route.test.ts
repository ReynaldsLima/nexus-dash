import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const streamTextMock = vi.fn(() => ({
  toTextStreamResponse: () => new Response('ok', { status: 200 }),
}))
vi.mock('ai', () => ({ streamText: streamTextMock }))
vi.mock('@/lib/ai/anthropic', () => ({ insightModel: {}, MODEL_ID: 'claude-sonnet-4-6' }))

const mockState = {
  user: null as { id: string; app_metadata?: Record<string, unknown> } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
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
            maybeSingle: () => Promise.resolve({ data: mockState.grant, error: null }),
          }),
        }),
      }),
    }),
  }),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/leads/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const validBody = {
  tenant: 'acme',
  system: 'Você é um assistente.',
  messages: [{ role: 'user', content: 'Quais leads priorizar?' }],
}

beforeEach(() => {
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.grant = null
  streamTextMock.mockClear()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  vi.resetModules()
})

describe('POST /api/leads/chat — hardening + SDK migration (F3 / AGENCY-08)', () => {
  it('no authenticated user → 401', async () => {
    mockState.user = null
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("role 'invalid_role' → 403", async () => {
    mockState.role = 'invalid_role'
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('role null / RPC error → 403', async () => {
    mockState.role = null
    mockState.roleError = { message: 'rpc failed' }
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('missing tenant in body → 400', async () => {
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest({ system: 's', messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(400)
  })

  it("role 'tenant_admin' with mismatched tenant_slug → 403", async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'user-1', app_metadata: { tenant_slug: 'outra-empresa' } }
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("role 'tenant_admin' with matching tenant_slug → 200 (streamed)", async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'user-1', app_metadata: { tenant_slug: 'acme' } }
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalled()
  })

  it("role 'agency' with no grant → 403", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: { agency_id: 'agency-1' } }
    mockState.grant = null
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("role 'agency' with a grant → 200", async () => {
    mockState.role = 'agency'
    mockState.user = { id: 'user-1', app_metadata: { agency_id: 'agency-1' } }
    mockState.grant = { tenant_id: 'tenant-1' }
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
  })

  it('super_admin valid request → 200 and calls streamText (not raw fetch)', async () => {
    const { POST } = await import('@/app/api/leads/chat/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledTimes(1)
  })

  it('21st call within window → 429 with Retry-After header (20/5min per user, D-03)', async () => {
    const { POST } = await import('@/app/api/leads/chat/route')
    let last: Response | undefined
    for (let i = 0; i < 21; i++) {
      last = await POST(makeRequest(validBody))
    }
    expect(last!.status).toBe(429)
    expect(last!.headers.get('Retry-After')).toBeTruthy()
  })
})
