import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  editTenantUserEmail,
  resetTenantUserPassword,
  removeTenantUserAccess,
} from '@/lib/actions/tenants'

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

const updateUserByIdMock = vi.fn(() => Promise.resolve(mockState.updateUserByIdResponse))
const rpcMock = vi.fn(() => Promise.resolve(mockState.revokeSessionsResponse))
const deleteEqInnerMock = vi.fn(() => Promise.resolve(mockState.deleteResponse))
const deleteEqOuterMock = vi.fn(() => ({ eq: deleteEqInnerMock }))
const deleteMock = vi.fn(() => ({ eq: deleteEqOuterMock }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        updateUserById: updateUserByIdMock,
        getUserById: vi.fn(() =>
          Promise.resolve({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })
        ),
      },
    },
    rpc: rpcMock,
    from: () => ({
      delete: deleteMock,
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
  updateUserByIdMock.mockClear()
  rpcMock.mockClear()
  deleteMock.mockClear()
  deleteEqOuterMock.mockClear()
  deleteEqInnerMock.mockClear()
})

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

describe('editTenantUserEmail Server Action (USER-03)', () => {
  it('editTenantUserEmail calls admin.updateUserById with email + email_confirm:true', async () => {
    const result = await editTenantUserEmail({
      userId: USER_ID,
      email: 'new@example.com',
      tenantId: TENANT_ID,
    })
    expect(result).toEqual({ ok: true })
    expect(updateUserByIdMock).toHaveBeenCalledWith(USER_ID, {
      email: 'new@example.com',
      email_confirm: true,
    })
  })

  it('editTenantUserEmail rejects a non-super_admin caller with the auth-gate error', async () => {
    mockState.role = 'tenant_admin'
    const result = await editTenantUserEmail({
      userId: USER_ID,
      email: 'new@example.com',
      tenantId: TENANT_ID,
    })
    expect(result).toEqual({ error: 'Apenas super_admin pode executar esta ação.' })
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })
})

describe('resetTenantUserPassword Server Action (USER-04)', () => {
  it('resetTenantUserPassword calls admin.updateUserById with a >=16-char generated password', async () => {
    const result = await resetTenantUserPassword({ userId: USER_ID, tenantId: TENANT_ID })
    expect('tempPassword' in result).toBe(true)
    if ('tempPassword' in result) {
      expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)
      expect(updateUserByIdMock).toHaveBeenCalledWith(USER_ID, { password: result.tempPassword })
    }
  })

  it('resetTenantUserPassword rejects a non-super_admin caller', async () => {
    mockState.role = 'tenant_admin'
    const result = await resetTenantUserPassword({ userId: USER_ID, tenantId: TENANT_ID })
    expect(result).toEqual({ error: 'Apenas super_admin pode executar esta ação.' })
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })
})

describe('removeTenantUserAccess Server Action (USER-05)', () => {
  it('removeTenantUserAccess deletes the tenant_users row scoped by BOTH tenant_id AND user_id', async () => {
    const result = await removeTenantUserAccess({ userId: USER_ID, tenantId: TENANT_ID })
    expect(result).toEqual({ ok: true })
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteEqOuterMock).toHaveBeenCalledWith('tenant_id', TENANT_ID)
    expect(deleteEqInnerMock).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('removeTenantUserAccess calls revoke_user_sessions RPC with the target user_id', async () => {
    await removeTenantUserAccess({ userId: USER_ID, tenantId: TENANT_ID })
    expect(rpcMock).toHaveBeenCalledWith('revoke_user_sessions', { target_user_id: USER_ID })
  })

  it('removeTenantUserAccess rejects a non-super_admin caller', async () => {
    mockState.role = 'tenant_admin'
    const result = await removeTenantUserAccess({ userId: USER_ID, tenantId: TENANT_ID })
    expect(result).toEqual({ error: 'Apenas super_admin pode executar esta ação.' })
    expect(deleteMock).not.toHaveBeenCalled()
  })
})

describe('tenant-user-management-actions scaffold sanity', () => {
  it('vi mock infrastructure is available', () => {
    const fn = vi.fn(() => 'ok')
    expect(fn()).toBe('ok')
  })
})
