import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 10 Wave 0 (USER-03/04/05) — RED scaffold for tenant user-management Server Actions.
 * Plan 02 implements editTenantUserEmail / resetTenantUserPassword / removeTenantUserAccess
 * (not yet created) and turns these it.todo() cases into real assertions.
 *
 * Mock shape mirrors tests/agencies.test.ts (@/lib/supabase/service) plus
 * tests/unit/leads-status-route.test.ts (@/lib/supabase/server, for the new
 * requireSuperAdmin() gate — 10-01's lib/actions/auth-guard.ts).
 */

const mockState = {
  user: null as { id: string } | null,
  role: null as string | null,
  roleError: null as { message: string } | null,
  updateUserByIdResponse: { error: null as null | { message: string } },
  deleteResponse: { error: null as null | { message: string } },
  revokeSessionsResponse: { error: null as null | { message: string } },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
    rpc: () => Promise.resolve({ data: mockState.role, error: mockState.roleError }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        updateUserById: vi.fn(() => Promise.resolve(mockState.updateUserByIdResponse)),
        getUserById: vi.fn(() =>
          Promise.resolve({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })
        ),
      },
    },
    rpc: vi.fn(() => Promise.resolve(mockState.revokeSessionsResponse)),
    from: () => ({
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve(mockState.deleteResponse),
        }),
      }),
    }),
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  mockState.user = { id: 'super-admin-1' }
  mockState.role = 'super_admin'
  mockState.roleError = null
  mockState.updateUserByIdResponse = { error: null }
  mockState.deleteResponse = { error: null }
  mockState.revokeSessionsResponse = { error: null }
})

describe('editTenantUserEmail Server Action (USER-03)', () => {
  it.todo('editTenantUserEmail calls admin.updateUserById with email + email_confirm:true')
  it.todo('editTenantUserEmail rejects a non-super_admin caller with the auth-gate error')
})

describe('resetTenantUserPassword Server Action (USER-04)', () => {
  it.todo('resetTenantUserPassword calls admin.updateUserById with a >=16-char generated password')
  it.todo('resetTenantUserPassword rejects a non-super_admin caller')
})

describe('removeTenantUserAccess Server Action (USER-05)', () => {
  it.todo('removeTenantUserAccess deletes the tenant_users row scoped by BOTH tenant_id AND user_id')
  it.todo('removeTenantUserAccess calls revoke_user_sessions RPC with the target user_id')
  it.todo('removeTenantUserAccess rejects a non-super_admin caller')
})

describe('tenant-user-management-actions scaffold sanity', () => {
  it('vi mock infrastructure is available', () => {
    const fn = vi.fn(() => 'ok')
    expect(fn()).toBe('ok')
  })
})
