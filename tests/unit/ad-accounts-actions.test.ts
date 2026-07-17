import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only lança erro em ambientes não-RSC (como Vitest/Node).
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockState = {
  user: null as { id: string; app_metadata?: Record<string, unknown> } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
  updateError: null as { message: string } | null,
}

const capturedUpdate = {
  payload: null as Record<string, unknown> | null,
  tenantId: null as string | null,
  channel: null as string | null,
  called: false,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
      // Route reads tenant_id from getClaims() (verified JWT claims), not from
      // getUser()'s user.app_metadata — see
      // .planning/debug/resolved/agency-app-metadata-getuser-mismatch.md.
      getClaims: () =>
        Promise.resolve({ data: { claims: { app_metadata: mockState.user?.app_metadata ?? {} } } }),
    },
    rpc: () => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      update: (payload: Record<string, unknown>) => {
        capturedUpdate.called = true
        capturedUpdate.payload = payload
        const chain = {
          eq(column: string, value: string) {
            if (column === 'tenant_id') capturedUpdate.tenantId = value
            if (column === 'channel') capturedUpdate.channel = value
            return chain
          },
          then(resolve: (value: { error: { message: string } | null }) => unknown) {
            return Promise.resolve({ error: mockState.updateError }).then(resolve)
          },
        }
        return chain
      },
    }),
  }),
}))

const VALID_TENANT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

beforeEach(() => {
  mockState.user = { id: 'user-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.updateError = null
  capturedUpdate.called = false
  capturedUpdate.payload = null
  capturedUpdate.tenantId = null
  capturedUpdate.channel = null
  vi.resetModules()
})

describe('updateBackfillWindow', () => {
  it('super_admin updating any tenant → { ok: true } and captured update payload', async () => {
    mockState.role = 'super_admin'
    const { updateBackfillWindow } = await import('@/lib/actions/ad-accounts')
    const result = await updateBackfillWindow({
      tenantId: VALID_TENANT_ID,
      tenantSlug: 'acme',
      channel: 'google_ads',
      days: 30,
    })
    expect(result).toEqual({ ok: true })
    expect(capturedUpdate.called).toBe(true)
    expect(capturedUpdate.payload).toEqual({ backfill_days: 30 })
    expect(capturedUpdate.tenantId).toBe(VALID_TENANT_ID)
    expect(capturedUpdate.channel).toBe('google_ads')
  })

  it('tenant_admin updating OWN tenant (claim matches) → { ok: true }', async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'u1', app_metadata: { tenant_id: VALID_TENANT_ID } }
    const { updateBackfillWindow } = await import('@/lib/actions/ad-accounts')
    const result = await updateBackfillWindow({
      tenantId: VALID_TENANT_ID,
      tenantSlug: 'acme',
      channel: 'meta_ads',
      days: 30,
    })
    expect(result).toEqual({ ok: true })
    expect(capturedUpdate.called).toBe(true)
  })

  it('tenant_admin updating a DIFFERENT tenant (claim mismatch) → { error }, no UPDATE', async () => {
    mockState.role = 'tenant_admin'
    mockState.user = { id: 'u1', app_metadata: { tenant_id: 'other-tenant-id' } }
    const { updateBackfillWindow } = await import('@/lib/actions/ad-accounts')
    const result = await updateBackfillWindow({
      tenantId: VALID_TENANT_ID,
      tenantSlug: 'acme',
      channel: 'meta_ads',
      days: 30,
    })
    expect('error' in result).toBe(true)
    expect(capturedUpdate.called).toBe(false)
  })

  it('unauthenticated (no user) → { error }, no UPDATE', async () => {
    mockState.user = null
    const { updateBackfillWindow } = await import('@/lib/actions/ad-accounts')
    const result = await updateBackfillWindow({
      tenantId: VALID_TENANT_ID,
      tenantSlug: 'acme',
      channel: 'google_ads',
      days: 30,
    })
    expect('error' in result).toBe(true)
    expect(capturedUpdate.called).toBe(false)
  })

  it('days out of range (5) → { error }, no UPDATE', async () => {
    mockState.role = 'super_admin'
    const { updateBackfillWindow } = await import('@/lib/actions/ad-accounts')
    const result = await updateBackfillWindow({
      tenantId: VALID_TENANT_ID,
      tenantSlug: 'acme',
      channel: 'google_ads',
      days: 5,
    })
    expect('error' in result).toBe(true)
    expect(capturedUpdate.called).toBe(false)
  })

  it('days out of range (400) → { error }, no UPDATE', async () => {
    mockState.role = 'super_admin'
    const { updateBackfillWindow } = await import('@/lib/actions/ad-accounts')
    const result = await updateBackfillWindow({
      tenantId: VALID_TENANT_ID,
      tenantSlug: 'acme',
      channel: 'google_ads',
      days: 400,
    })
    expect('error' in result).toBe(true)
    expect(capturedUpdate.called).toBe(false)
  })
})
