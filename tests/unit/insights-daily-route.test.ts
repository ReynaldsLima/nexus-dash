import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * AI-02 — POST /api/insights/daily is the N8N-triggered daily analysis route. It has NO Supabase
 * user session; auth is a shared-secret header compared against process.env.N8N_INSIGHTS_SECRET
 * (04-RESEARCH.md Architecture Pattern 2). It also validates that the body's tenantId actually
 * has >= 1 ad_accounts row before processing (D-07 eligibility, anti-pattern: never trust an
 * arbitrary tenantId).
 */

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))

const mockState = {
  accounts: [{ id: 'account-1' }] as { id: string }[] | null,
  insertSpy: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'ad_accounts') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: mockState.accounts, error: null }),
            }),
          }),
        }
      }
      // ai_insights insert
      return {
        insert: (row: unknown) => {
          mockState.insertSpy(row)
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }),
}))

vi.mock('@/lib/ai/insight-prompt', () => ({
  buildDailyPrompt: () => Promise.resolve({ system: 'system prompt', user: 'user prompt' }),
}))

vi.mock('ai', () => ({
  generateText: () =>
    Promise.resolve({
      text: 'Análise diária concluída.\n<insight_data>{"type":"optimization","title":"Título","impact":"medium","metrics":[],"recommendations":["rec 1"]}</insight_data>',
    }),
}))

function makeRequest(body: unknown, headers: Record<string, string> = { 'x-n8n-secret': 'test-secret' }) {
  return new Request('http://localhost/api/insights/daily', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })
}

beforeEach(() => {
  process.env.N8N_INSIGHTS_SECRET = 'test-secret'
  mockState.accounts = [{ id: 'account-1' }]
  mockState.insertSpy = vi.fn()
  vi.resetModules()
})

describe('POST /api/insights/daily — shared-secret gate (AI-02)', () => {
  it('missing x-n8n-secret header → 401', async () => {
    const { POST } = await import('@/app/api/insights/daily/route')
    const res = await POST(makeRequest({ tenantId: 'tenant-1' }, {}))
    expect(res.status).toBe(401)
  })

  it('wrong x-n8n-secret value → 401', async () => {
    const { POST } = await import('@/app/api/insights/daily/route')
    const res = await POST(makeRequest({ tenantId: 'tenant-1' }, { 'x-n8n-secret': 'wrong-secret' }))
    expect(res.status).toBe(401)
  })

  it('correct x-n8n-secret but tenant has zero ad_accounts rows → 200 skipped (no insight generated)', async () => {
    mockState.accounts = []
    const { POST } = await import('@/app/api/insights/daily/route')
    const res = await POST(makeRequest({ tenantId: 'tenant-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ skipped: true, reason: 'no ad_accounts' })
    expect(mockState.insertSpy).not.toHaveBeenCalled()
  })

  it('correct x-n8n-secret and eligible tenant → generates + inserts one ai_insights row with source=daily', async () => {
    const { POST } = await import('@/app/api/insights/daily/route')
    const res = await POST(makeRequest({ tenantId: 'tenant-1' }))
    expect(res.status).toBe(200)
    expect(mockState.insertSpy).toHaveBeenCalledTimes(1)
    expect(mockState.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-1', source: 'daily' })
    )
  })
})

describe('insights-daily-route scaffold sanity', () => {
  it('vitest is wired', () => {
    expect(true).toBe(true)
  })
})
