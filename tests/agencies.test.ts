import { describe, it, expect, vi } from 'vitest'

/**
 * AGENCY-01 — Super Admin can create an agency and add agency users via lib/actions/agencies.ts.
 * AGENCY-02 — Super Admin can grant/revoke an agency's access to N Cliente tenants.
 *
 * Mirrors tests/tenants.test.ts's mock-based approach (mocks @/lib/supabase/service, no network).
 *
 * Filled in by Plan 05 (lib/actions/agencies.ts implementation).
 */
describe('createAgency Server Action (AGENCY-01)', () => {
  it.todo('inserts a row into public.agencies with active=true')
  it.todo('returns { ok: true, agencyId } on success')
})

describe('deactivateAgency / reactivateAgency Server Actions (AGENCY-01)', () => {
  it.todo('sets active=false on the matching agency (does NOT delete the row)')
  it.todo('reactivateAgency sets active=true')
})

describe('createAgencyUser Server Action (AGENCY-01 + D-04)', () => {
  it.todo('calls supabase.auth.admin.createUser with email_confirm=true')
  it.todo('inserts the new user into agency_users (never into tenant_users — D-04)')
  it.todo('generates a 16-char temporary password when none is supplied')
  it.todo('rolls back auth user creation if the agency_users insert fails (mirrors createTenantUser)')
})

describe('grantTenant / revokeTenant Server Actions (AGENCY-02)', () => {
  it.todo('grantTenant inserts a row into agency_tenants(agency_id, tenant_id)')
  it.todo('revokeTenant deletes the matching agency_tenants row')
  it.todo('grantTenant is idempotent — granting an already-granted tenant does not error (UNIQUE conflict handled)')
})

describe('agencies module sanity', () => {
  it('vi mock infrastructure is available', () => {
    const fn = vi.fn(() => 'ok')
    expect(fn()).toBe('ok')
  })
})
