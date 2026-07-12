import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  editAgencyUserEmail,
  resetAgencyUserPassword,
  removeAgencyUserAccess,
} from '@/lib/actions/agencies'

/**
 * Phase 10 Wave 0 (USER-03/04/05) — RED scaffold for agency user-management Server Actions.
 * Plan 02 implements editAgencyUserEmail / resetAgencyUserPassword / removeAgencyUserAccess
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

const AGENCY_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'

describe('editAgencyUserEmail Server Action (USER-03)', () => {
  it('editAgencyUserEmail calls admin.updateUserById with email + email_confirm:true', async () => {
    const result = await editAgencyUserEmail({
      userId: USER_ID,
      email: 'new@example.com',
      agencyId: AGENCY_ID,
    })
    expect(result).toEqual({ ok: true })
    expect(updateUserByIdMock).toHaveBeenCalledWith(USER_ID, {
      email: 'new@example.com',
      email_confirm: true,
    })
  })

  it('editAgencyUserEmail rejects a non-super_admin caller with the auth-gate error', async () => {
    mockState.role = 'agency'
    const result = await editAgencyUserEmail({
      userId: USER_ID,
      email: 'new@example.com',
      agencyId: AGENCY_ID,
    })
    expect(result).toEqual({ error: 'Apenas super_admin pode executar esta ação.' })
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })
})

describe('resetAgencyUserPassword Server Action (USER-04)', () => {
  it('resetAgencyUserPassword calls admin.updateUserById with a >=16-char generated password', async () => {
    const result = await resetAgencyUserPassword({ userId: USER_ID, agencyId: AGENCY_ID })
    expect('tempPassword' in result).toBe(true)
    if ('tempPassword' in result) {
      expect(result.tempPassword.length).toBeGreaterThanOrEqual(16)
      expect(updateUserByIdMock).toHaveBeenCalledWith(USER_ID, { password: result.tempPassword })
    }
  })

  it('resetAgencyUserPassword rejects a non-super_admin caller', async () => {
    mockState.role = 'agency'
    const result = await resetAgencyUserPassword({ userId: USER_ID, agencyId: AGENCY_ID })
    expect(result).toEqual({ error: 'Apenas super_admin pode executar esta ação.' })
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })
})

describe('removeAgencyUserAccess Server Action (USER-05)', () => {
  it('removeAgencyUserAccess deletes the agency_users row scoped by BOTH agency_id AND user_id', async () => {
    const result = await removeAgencyUserAccess({ userId: USER_ID, agencyId: AGENCY_ID })
    expect(result).toEqual({ ok: true })
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteEqOuterMock).toHaveBeenCalledWith('agency_id', AGENCY_ID)
    expect(deleteEqInnerMock).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('removeAgencyUserAccess calls revoke_user_sessions RPC with the target user_id', async () => {
    await removeAgencyUserAccess({ userId: USER_ID, agencyId: AGENCY_ID })
    expect(rpcMock).toHaveBeenCalledWith('revoke_user_sessions', { target_user_id: USER_ID })
  })

  it('removeAgencyUserAccess rejects a non-super_admin caller', async () => {
    mockState.role = 'agency'
    const result = await removeAgencyUserAccess({ userId: USER_ID, agencyId: AGENCY_ID })
    expect(result).toEqual({ error: 'Apenas super_admin pode executar esta ação.' })
    expect(deleteMock).not.toHaveBeenCalled()
  })
})

describe('agency-user-management-actions scaffold sanity', () => {
  it('vi mock infrastructure is available', () => {
    const fn = vi.fn(() => 'ok')
    expect(fn()).toBe('ok')
  })
})
