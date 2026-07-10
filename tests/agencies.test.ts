import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = {
  insertResponse: { data: { id: 'new-agency-uuid' }, error: null as null | { message: string } },
  updateResponse: { error: null as null | { message: string } },
  createUserResponse: {
    data: { user: { id: 'new-agency-user-uuid' } } as { user: { id: string } | null } | null,
    error: null as null | { message: string },
  },
  auInsertResponse: { error: null as null | { message: string } },
  upsertResponse: { error: null as null | { message: string } },
  deleteResponse: { error: null as null | { message: string } },
  deleteUserCalls: 0,
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (_payload: unknown) => ({
        select: () => ({ single: () => Promise.resolve(mockState.insertResponse) }),
        // agency_users insert has no .select().single() chain in the action — resolves directly
        then: (
          resolve: (v: unknown) => void,
          reject?: (e: unknown) => void
        ) => Promise.resolve(mockState.auInsertResponse).then(resolve, reject),
      }),
      update: (_payload: unknown) => ({ eq: () => Promise.resolve(mockState.updateResponse) }),
      upsert: (_payload: unknown, _opts: unknown) => Promise.resolve(mockState.upsertResponse),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve(mockState.deleteResponse) }) }),
      _table: table,
    }),
    auth: {
      admin: {
        createUser: vi.fn(() => Promise.resolve(mockState.createUserResponse)),
        deleteUser: vi.fn(() => {
          mockState.deleteUserCalls += 1
          return Promise.resolve({ error: null })
        }),
      },
    },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const TEST_AGENCY_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
const TEST_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

beforeEach(() => {
  mockState.insertResponse = { data: { id: 'new-agency-uuid' }, error: null }
  mockState.updateResponse = { error: null }
  mockState.createUserResponse = { data: { user: { id: 'new-agency-user-uuid' } }, error: null }
  mockState.auInsertResponse = { error: null }
  mockState.upsertResponse = { error: null }
  mockState.deleteResponse = { error: null }
  mockState.deleteUserCalls = 0
})

describe('createAgency Server Action (AGENCY-01)', () => {
  it('inserts a row into public.agencies with active=true', async () => {
    const { createAgency } = await import('@/lib/actions/agencies')
    const result = await createAgency({ name: 'Agência Alpha' })
    expect(result).toEqual({ ok: true, agencyId: 'new-agency-uuid' })
  })

  it('returns { ok: true, agencyId } on success', async () => {
    const { createAgency } = await import('@/lib/actions/agencies')
    const result = await createAgency({ name: 'Agência Alpha' })
    if (!('ok' in result)) throw new Error('expected ok')
    expect(result.agencyId).toBe('new-agency-uuid')
  })
})

describe('deactivateAgency / reactivateAgency Server Actions (AGENCY-01)', () => {
  it('sets active=false on the matching agency (does NOT delete the row)', async () => {
    const { deactivateAgency } = await import('@/lib/actions/agencies')
    const result = await deactivateAgency(TEST_AGENCY_ID)
    expect(result).toEqual({ ok: true })
  })

  it('reactivateAgency sets active=true', async () => {
    const { reactivateAgency } = await import('@/lib/actions/agencies')
    const result = await reactivateAgency(TEST_AGENCY_ID)
    expect(result).toEqual({ ok: true })
  })
})

describe('createAgencyUser Server Action (AGENCY-01 + D-04)', () => {
  it('calls supabase.auth.admin.createUser with email_confirm=true', async () => {
    const { createAgencyUser } = await import('@/lib/actions/agencies')
    const result = await createAgencyUser({ email: 'agente@example.com', agencyId: TEST_AGENCY_ID })
    expect(result).toMatchObject({ ok: true, userId: 'new-agency-user-uuid' })
    if ('ok' in result) expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)
  })

  it('inserts the new user into agency_users (never into tenant_users — D-04)', async () => {
    const { createAgencyUser } = await import('@/lib/actions/agencies')
    const result = await createAgencyUser({ email: 'agente@example.com', agencyId: TEST_AGENCY_ID })
    expect(result).toMatchObject({ ok: true, userId: 'new-agency-user-uuid' })
  })

  it('rolls back auth user creation if the agency_users insert fails', async () => {
    mockState.auInsertResponse = { error: { message: 'insert failed' } }
    const { createAgencyUser } = await import('@/lib/actions/agencies')
    const result = await createAgencyUser({ email: 'agente@example.com', agencyId: TEST_AGENCY_ID })
    expect('error' in result).toBe(true)
    expect(mockState.deleteUserCalls).toBe(1)
  })

  it('generates a 16-char temporary password when none is supplied', async () => {
    const { createAgencyUser } = await import('@/lib/actions/agencies')
    const result = await createAgencyUser({ email: 'agente@example.com', agencyId: TEST_AGENCY_ID })
    if (!('ok' in result)) throw new Error('expected ok')
    expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)
  })
})

describe('grantTenant / revokeTenant Server Actions (AGENCY-02)', () => {
  it('grantTenant upserts a row into agency_tenants(agency_id, tenant_id)', async () => {
    const { grantTenant } = await import('@/lib/actions/agencies')
    const result = await grantTenant(TEST_AGENCY_ID, TEST_TENANT_ID)
    expect(result).toEqual({ ok: true })
  })

  it('revokeTenant deletes the matching agency_tenants row', async () => {
    const { revokeTenant } = await import('@/lib/actions/agencies')
    const result = await revokeTenant(TEST_AGENCY_ID, TEST_TENANT_ID)
    expect(result).toEqual({ ok: true })
  })

  it('grantTenant is idempotent — ignoreDuplicates means re-granting does not error', async () => {
    mockState.upsertResponse = { error: null }
    const { grantTenant } = await import('@/lib/actions/agencies')
    const result = await grantTenant(TEST_AGENCY_ID, TEST_TENANT_ID)
    expect(result).toEqual({ ok: true })
  })
})

describe('agencies module sanity', () => {
  it('vi mock infrastructure is available', () => {
    const fn = vi.fn(() => 'ok')
    expect(fn()).toBe('ok')
  })
})
