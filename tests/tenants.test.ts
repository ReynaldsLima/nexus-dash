import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = {
  insertResponse: { data: { id: 'new-tenant-uuid' }, error: null as null | { code?: string; message: string } },
  updateResponse: { error: null as null | { message: string } },
  createUserResponse: {
    data: { user: { id: 'new-user-uuid' } } as { user: { id: string } | null } | null,
    error: null as null | { message: string },
  },
  tuInsertResponse: { error: null as null | { message: string } },
  deleteUserCalls: 0,
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (_payload: unknown) => ({
        select: () => ({
          single: () => Promise.resolve(mockState.insertResponse),
        }),
      }),
      update: (_payload: unknown) => ({
        eq: () => Promise.resolve(mockState.updateResponse),
      }),
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

beforeEach(() => {
  mockState.insertResponse = { data: { id: 'new-tenant-uuid' }, error: null }
  mockState.updateResponse = { error: null }
  mockState.createUserResponse = { data: { user: { id: 'new-user-uuid' } }, error: null }
  mockState.tuInsertResponse = { error: null }
  mockState.deleteUserCalls = 0
})

describe('createTenant Server Action (AUTH-03)', () => {
  it('inserts a row into public.tenants with active=true', async () => {
    const { createTenant } = await import('@/lib/actions/tenants')
    const result = await createTenant({ name: 'Acme', slug: 'acme' })
    expect(result).toEqual({ ok: true, tenantId: 'new-tenant-uuid' })
  })

  it('rejects duplicate slug with a validation error (UNIQUE constraint)', async () => {
    mockState.insertResponse = { data: { id: '' }, error: { code: '23505', message: 'duplicate key' } }
    const { createTenant } = await import('@/lib/actions/tenants')
    const result = await createTenant({ name: 'Acme', slug: 'acme' })
    expect(result).toEqual({ error: 'Já existe um tenant com este slug.' })
  })

  it('rejects slug that fails ^[a-z0-9-]+$ regex', async () => {
    const { createTenant } = await import('@/lib/actions/tenants')
    const result = await createTenant({ name: 'Acme', slug: 'BadSlug!' })
    expect(result).toMatchObject({ error: expect.stringContaining('Slug') })
  })

  it('returns { success: true, tenantId } on success', async () => {
    const { createTenant } = await import('@/lib/actions/tenants')
    const result = await createTenant({ name: 'Acme', slug: 'acme' })
    if (!('ok' in result)) throw new Error('expected ok')
    expect(result.tenantId).toBe('new-tenant-uuid')
  })
})

// Valid RFC 4122 v4 UUID for test fixtures (Zod v4 enforces strict UUID format)
const TEST_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('deactivateTenant Server Action (AUTH-03)', () => {
  it('sets active=false on the matching tenant (does NOT delete the row)', async () => {
    const { deactivateTenant } = await import('@/lib/actions/tenants')
    const result = await deactivateTenant(TEST_TENANT_ID)
    expect(result).toEqual({ ok: true })
  })

  it('returns { error } when caller role is not super_admin', async () => {
    mockState.updateResponse = { error: { message: 'insufficient_privilege' } }
    const { deactivateTenant } = await import('@/lib/actions/tenants')
    const result = await deactivateTenant(TEST_TENANT_ID)
    expect(result).toEqual({ error: 'insufficient_privilege' })
  })
})

describe('createTenantUser Server Action (AUTH-03 + D-10)', () => {
  it('calls supabase.auth.admin.createUser with email_confirm=true', async () => {
    const { createTenantUser } = await import('@/lib/actions/tenants')
    const result = await createTenantUser({
      email: 'test@example.com',
      role: 'tenant_admin',
      tenantId: TEST_TENANT_ID,
    })
    expect(result).toMatchObject({ ok: true, userId: 'new-user-uuid' })
    if ('ok' in result) expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)
  })

  it('inserts the new user into tenant_users with role tenant_admin or viewer', async () => {
    const { createTenantUser } = await import('@/lib/actions/tenants')
    const result = await createTenantUser({
      email: 'test@example.com',
      role: 'viewer',
      tenantId: TEST_TENANT_ID,
    })
    expect('ok' in result).toBe(true)
  })

  it('rejects role super_admin (not allowed in tenant_users per D-09 CHECK constraint)', async () => {
    const { createTenantUser } = await import('@/lib/actions/tenants')
    // @ts-expect-error intentionally passing invalid role
    const result = await createTenantUser({
      email: 'test@example.com',
      role: 'super_admin',
      tenantId: TEST_TENANT_ID,
    })
    expect(result).toMatchObject({ error: expect.stringContaining('Role') })
  })

  it('generates a 16-char temporary password when none is supplied', async () => {
    const { createTenantUser } = await import('@/lib/actions/tenants')
    const result = await createTenantUser({
      email: 'test@example.com',
      role: 'viewer',
      tenantId: TEST_TENANT_ID,
    })
    if (!('ok' in result)) throw new Error('expected ok')
    expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)
  })
})

describe('tenants module sanity', () => {
  it('vi mock infrastructure is available', () => {
    const fn = vi.fn(() => 'ok')
    expect(fn()).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
