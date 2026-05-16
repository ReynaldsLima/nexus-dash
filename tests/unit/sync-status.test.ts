import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
// Mock necessário para testes unitários de módulos server-only.
vi.mock('server-only', () => ({}))

const mockState = {
  response: { data: null as any, error: null as null | { code: string; message: string } },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve(mockState.response),
        }),
      }),
    }),
  }),
}))

beforeEach(() => {
  mockState.response = { data: null, error: null }
  vi.resetModules()
})

describe('loadLastSyncByTenantChannel (SYNC-03)', () => {
  it('retorna [] quando não há sync_jobs', async () => {
    mockState.response = { data: [], error: null }
    const { loadLastSyncByTenantChannel } = await import('@/lib/sync-status')
    const result = await loadLastSyncByTenantChannel()
    expect(result).toEqual([])
  })

  it('dedupe: retorna apenas o último por (tenant_id, channel)', async () => {
    mockState.response = {
      data: [
        { tenant_id: 'T1', channel: 'google_ads', status: 'success', completed_at: '2026-05-16T10:00:00Z', started_at: '2026-05-16T09:55:00Z', records_synced: 100, error_message: null, tenants: { name: 'Acme', slug: 'acme' } },
        { tenant_id: 'T1', channel: 'google_ads', status: 'failed',  completed_at: '2026-05-16T07:00:00Z', started_at: '2026-05-16T06:55:00Z', records_synced: 0,   error_message: 'timeout', tenants: { name: 'Acme', slug: 'acme' } },
        { tenant_id: 'T1', channel: 'meta_ads',  status: 'success', completed_at: '2026-05-16T08:00:00Z', started_at: '2026-05-16T07:55:00Z', records_synced: 50,  error_message: null, tenants: { name: 'Acme', slug: 'acme' } },
      ],
      error: null,
    }
    const { loadLastSyncByTenantChannel } = await import('@/lib/sync-status')
    const result = await loadLastSyncByTenantChannel()
    expect(result).toHaveLength(2)
    const g = result.find(r => r.channel === 'google_ads')!
    expect(g.status).toBe('success')
    expect(g.completed_at).toBe('2026-05-16T10:00:00Z')
  })

  it('shape do SyncStatusRow inclui tenant_name e tenant_slug do embed', async () => {
    mockState.response = {
      data: [
        { tenant_id: 'T1', channel: 'google_ads', status: 'success', completed_at: '2026-05-16T10:00:00Z', started_at: null, records_synced: 100, error_message: null, tenants: { name: 'Acme Corp', slug: 'acme' } },
      ],
      error: null,
    }
    const { loadLastSyncByTenantChannel } = await import('@/lib/sync-status')
    const [row] = await loadLastSyncByTenantChannel()
    expect(row.tenant_name).toBe('Acme Corp')
    expect(row.tenant_slug).toBe('acme')
    expect(row.channel).toBe('google_ads')
  })

  it('retorna [] em caso de error sem throw', async () => {
    mockState.response = { data: null, error: { code: '42P01', message: 'relation does not exist' } }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadLastSyncByTenantChannel } = await import('@/lib/sync-status')
    const result = await loadLastSyncByTenantChannel()
    expect(result).toEqual([])
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
